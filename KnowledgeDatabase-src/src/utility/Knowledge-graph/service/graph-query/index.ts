/**
 * @file 图谱数据流式查询服务
 * @description 异步分页查询图谱实体和关系，流式返回给主进程
 */

import type { KGSurrealClient } from '../../db/surreal-client'
import type {
  KGToMainMessage,
  KGGraphQueryParams,
  KGGraphEntity,
  KGGraphRelation,
  KGGraphDataProgress
} from '@shared/knowledge-graph-ipc.types'

// ============================================================================
// 类型定义
// ============================================================================

interface QuerySession {
  sessionId: string
  params: KGGraphQueryParams
  cancelled: boolean
  entitiesTotal: number
  relationsTotal: number
  entitiesLoaded: number
  relationsLoaded: number
}

// ============================================================================
// 日志
// ============================================================================

const log = (msg: string, data?: any): void => {
  if (data) {
    console.log(`[GraphQueryService] ${msg}`, data)
  } else {
    console.log(`[GraphQueryService] ${msg}`)
  }
}

const logError = (msg: string, error?: any): void => {
  console.error(`[GraphQueryService] ${msg}`, error)
}

// ============================================================================
// GraphQueryService
// ============================================================================

export class GraphQueryService {
  private sessions: Map<string, QuerySession> = new Map()
  private client: KGSurrealClient
  private sendMessage: (msg: KGToMainMessage) => void

  constructor(client: KGSurrealClient, sendMessage: (msg: KGToMainMessage) => void) {
    this.client = client
    this.sendMessage = sendMessage
  }

  /**
   * 开始查询，返回 sessionId
   */
  startQuery(params: KGGraphQueryParams): string {
    const sessionId = `qs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const session: QuerySession = {
      sessionId,
      params: {
        ...params,
        batchSize: params.batchSize ?? 100
      },
      cancelled: false,
      entitiesTotal: 0,
      relationsTotal: 0,
      entitiesLoaded: 0,
      relationsLoaded: 0
    }

    this.sessions.set(sessionId, session)
    log(`Query started: ${sessionId}`, params)

    // 异步执行查询，不阻塞返回
    this.executeQuery(session).catch((error) => {
      logError(`Query failed: ${sessionId}`, error)
      this.sendMessage({
        type: 'kg:graph-data-error',
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      })
      this.sessions.delete(sessionId)
    })

    return sessionId
  }

  /**
   * 取消查询
   */
  cancelQuery(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) {
      log(`Cancel ignored - session not found: ${sessionId}`)
      return false
    }

    session.cancelled = true
    log(`Query cancelled: ${sessionId}`)
    return true
  }

  /**
   * 执行异步查询流程
   */
  private async executeQuery(session: QuerySession): Promise<void> {
    const { sessionId } = session
    const { batchSize } = session.params

    // 1. 查询总数
    try {
      await this.queryTotals(session)
    } catch (error) {
      // 查询总数失败（可能表不存在），视为空数据
      log(`Query totals failed, treating as empty: ${sessionId}`, error)
      session.entitiesTotal = 0
      session.relationsTotal = 0
    }

    if (session.cancelled) {
      this.handleCancelled(session)
      return
    }

    log(`Totals: ${session.entitiesTotal} entities, ${session.relationsTotal} relations`)

    // 如果数据为空，直接完成（不报错）
    if (session.entitiesTotal === 0 && session.relationsTotal === 0) {
      log(`Empty graph data, completing: ${sessionId}`)
      this.sendMessage({
        type: 'kg:graph-data-complete',
        sessionId
      })
      this.sessions.delete(sessionId)
      return
    }

    // 2. 分页查询实体
    let entitiesStart = 0
    while (entitiesStart < session.entitiesTotal) {
      if (session.cancelled) {
        this.handleCancelled(session)
        return
      }

      const entities = await this.queryEntitiesBatch(session, entitiesStart)
      session.entitiesLoaded += entities.length

      // 发送批次数据
      this.sendBatch(session, entities, [])

      entitiesStart += batchSize!

      // 让出事件循环
      await this.yieldEventLoop()
    }

    // 3. 分页查询关系
    let relationsStart = 0
    while (relationsStart < session.relationsTotal) {
      if (session.cancelled) {
        this.handleCancelled(session)
        return
      }

      const relations = await this.queryRelationsBatch(session, relationsStart)
      session.relationsLoaded += relations.length

      // 发送批次数据
      this.sendBatch(session, [], relations)

      relationsStart += batchSize!

      // 让出事件循环
      await this.yieldEventLoop()
    }

    // 4. 完成
    this.sendMessage({
      type: 'kg:graph-data-complete',
      sessionId
    })

    log(`Query completed: ${sessionId}`)
    this.sessions.delete(sessionId)
  }

  /**
   * 查询实体和关系总数
   */
  private async queryTotals(session: QuerySession): Promise<void> {
    const { targetNamespace, targetDatabase, graphTableBase } = session.params

    // 查询实体总数
    const entityCountSql = `SELECT count() FROM ${graphTableBase}_entity GROUP ALL;`
    const entityCountResult = await this.client.queryInDatabase(
      targetNamespace,
      targetDatabase,
      entityCountSql
    )
    const entityCountRecords = this.client.extractRecords(entityCountResult)
    session.entitiesTotal = entityCountRecords[0]?.count ?? 0

    // 查询关系总数
    const relationCountSql = `SELECT count() FROM ${graphTableBase}_relates GROUP ALL;`
    const relationCountResult = await this.client.queryInDatabase(
      targetNamespace,
      targetDatabase,
      relationCountSql
    )
    const relationCountRecords = this.client.extractRecords(relationCountResult)
    session.relationsTotal = relationCountRecords[0]?.count ?? 0
  }

  /**
   * 分页查询实体
   */
  private async queryEntitiesBatch(
    session: QuerySession,
    start: number
  ): Promise<KGGraphEntity[]> {
    const { targetNamespace, targetDatabase, graphTableBase, batchSize } = session.params

    const sql = `
      SELECT 
        meta::id(id) as id,
        entity_name as name,
        entity_type as type,
        description
      FROM ${graphTableBase}_entity
      LIMIT ${batchSize} START ${start};
    `

    const result = await this.client.queryInDatabase(targetNamespace, targetDatabase, sql)
    const records = this.client.extractRecords(result)

    return records.map((r: any) => ({
      id: String(r.id),
      name: r.name ?? '',
      type: r.type ?? '',
      description: r.description ?? ''
    }))
  }

  /**
   * 分页查询关系
   */
  private async queryRelationsBatch(
    session: QuerySession,
    start: number
  ): Promise<KGGraphRelation[]> {
    const { targetNamespace, targetDatabase, graphTableBase, batchSize } = session.params

    const sql = `
      SELECT 
        meta::id(id) as id,
        meta::id(in) as target,
        meta::id(out) as source,
        keywords,
        description,
        weight
      FROM ${graphTableBase}_relates
      LIMIT ${batchSize} START ${start};
    `

    const result = await this.client.queryInDatabase(targetNamespace, targetDatabase, sql)
    const records = this.client.extractRecords(result)

    return records.map((r: any) => ({
      id: String(r.id),
      source: String(r.source ?? ''),
      target: String(r.target ?? ''),
      keywords: r.keywords ?? '',
      description: r.description ?? '',
      weight: r.weight ?? 1
    }))
  }

  /**
   * 发送批次数据
   */
  private sendBatch(
    session: QuerySession,
    entities: KGGraphEntity[],
    relations: KGGraphRelation[]
  ): void {
    const progress: KGGraphDataProgress = {
      entitiesLoaded: session.entitiesLoaded,
      entitiesTotal: session.entitiesTotal,
      relationsLoaded: session.relationsLoaded,
      relationsTotal: session.relationsTotal
    }

    this.sendMessage({
      type: 'kg:graph-data-batch',
      sessionId: session.sessionId,
      entities,
      relations,
      progress
    })
  }

  /**
   * 处理取消
   */
  private handleCancelled(session: QuerySession): void {
    this.sendMessage({
      type: 'kg:graph-data-cancelled',
      sessionId: session.sessionId
    })
    log(`Query cancelled notification sent: ${session.sessionId}`)
    this.sessions.delete(session.sessionId)
  }

  /**
   * 让出事件循环
   */
  private yieldEventLoop(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve))
  }
}

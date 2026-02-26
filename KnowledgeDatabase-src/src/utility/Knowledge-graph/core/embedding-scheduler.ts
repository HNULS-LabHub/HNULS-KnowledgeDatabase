/**
 * @file EmbeddingScheduler - 实体/关系向量嵌入调度器
 * @description 常驻单例，运行在 Knowledge-graph 子进程中。
 *   状态机：idle（5s 轮询）→ active（批量嵌入）→ indexing（HNSW）→ idle
 *   纯内存驱动，不建中间表，中断即丢弃当前批次。
 */

import { createHash } from 'crypto'
import type { KGSurrealClient } from '../db/surreal-client'
import type {
  KGToMainMessage,
  KGEmbeddingProgressData,
  KGEmbeddingRecoveryItem
} from '@shared/knowledge-graph-ipc.types'
import { getKgTableNames } from '../service/graph-schema'

// ============================================================================
// 类型定义
// ============================================================================

export interface EmbeddingConfig {
  baseUrl: string
  apiKey: string
  model: string
  dimensions: number
  batchSize: number
  maxTokens: number
}

export interface TargetInfo {
  namespace: string
  database: string
  graphTableBase: string
}

export type SchedulerState = 'idle' | 'active' | 'error'
export type EmbeddingTarget = 'entity' | 'relation'

export interface BatchResult {
  target: EmbeddingTarget
  successCount: number
  failCount: number
  durationMs: number
  remaining: number
}

export interface EmbeddingStatus {
  state: SchedulerState
  completed: number
  pending: number
  total: number
  hnswIndexReady: boolean
  entityCompleted: number
  entityPending: number
  entityTotal: number
  relationCompleted: number
  relationPending: number
  relationTotal: number
  entityHnswIndexReady: boolean
  relationHnswIndexReady: boolean
  lastError: string | null
  lastBatchInfo: BatchResult | null
}

/** 扫描到的实体行 */
interface EntityRow {
  id: string
  entity_name: string
  description: string
}

/** 扫描到的关系行 */
interface RelationRow {
  id: string
  keywords: string
  description: string
  source: string
  target: string
}

/** OpenAI 兼容的 Embedding API 响应 */
interface EmbeddingAPIResponse {
  data?: Array<{ embedding: number[]; index?: number }>
  error?: { message?: string; type?: string; code?: string | number }
}

// ============================================================================
// 日志工具
// ============================================================================

const log = (msg: string, data?: any): void => {
  if (data) console.log(`[KG-EmbeddingScheduler] ${msg}`, JSON.stringify(data))
  else console.log(`[KG-EmbeddingScheduler] ${msg}`)
}

const logError = (msg: string, error?: any): void => {
  console.error(`[KG-EmbeddingScheduler] ${msg}`, error)
}

// ============================================================================
// 纯函数：构造嵌入文本
// ============================================================================

/**
 * 构造嵌入文本：按 `\n---\n` 分段，从头累加到 maxTokens*4 字符
 * 格式：`{name}: {truncated_text}`
 *
 * @param name 实体名称
 * @param description 实体描述（可能包含 \n---\n 分隔符）
 * @param maxTokens 最大 token 数（字符上限 = maxTokens * 4）
 */
export function buildEmbeddingText(name: string, description: string, maxTokens: number): string {
  const charLimit = maxTokens * 4
  const segments = description.split('\n---\n')

  let accumulated = ''
  for (const seg of segments) {
    if (accumulated.length + seg.length > charLimit) break
    accumulated += seg
  }

  return `${name}: ${accumulated}`
}

/**
 * 构造关系嵌入文本：拼接关键词 + 关系端点 + 描述
 */
export function buildRelationEmbeddingText(
  source: string,
  target: string,
  keywords: string,
  description: string,
  maxTokens: number
): string {
  const relationBody = `${keywords}\n${source}\n${target}\n${description}`
  const charLimit = maxTokens * 4
  const segments = relationBody.split('\n---\n')

  let accumulated = ''
  for (const seg of segments) {
    if (accumulated.length + seg.length > charLimit) break
    accumulated += seg
  }

  return `relation: ${accumulated}`
}

// ============================================================================
// EmbeddingScheduler 类
// ============================================================================

export class EmbeddingScheduler {
  // 依赖
  private client: KGSurrealClient
  private sendMessage: (msg: KGToMainMessage) => void

  // 状态
  private state: SchedulerState = 'idle'
  private pollTimer: ReturnType<typeof setTimeout> | null = null
  private isProcessing = false
  private running = false

  // 配置（由 trigger 消息设置）
  private embeddingConfig: EmbeddingConfig | null = null
  private targetInfo: TargetInfo | null = null

  // HNSW 索引缓存
  private hnswCreatedSet: Set<string> = new Set()

  // 统计（实体）
  private entityCompletedCount = 0
  private entityPendingCount = 0
  private entityTotalCount = 0

  // 统计（关系）
  private relationCompletedCount = 0
  private relationPendingCount = 0
  private relationTotalCount = 0

  // 调试信息
  private lastError: string | null = null
  private lastBatchInfo: BatchResult | null = null

  // 常量
  private readonly IDLE_POLL_INTERVAL = 5000
  private readonly ACTIVE_POLL_INTERVAL = 100
  private readonly API_TIMEOUT_MS = 30000

  constructor(client: KGSurrealClient, sendMessage: (msg: KGToMainMessage) => void) {
    this.client = client
    this.sendMessage = sendMessage
  }

  // ==========================================================================
  // 公共方法
  // ==========================================================================

  /** 启动 idle 轮询 */
  start(): void {
    if (this.running) return
    this.running = true
    log('EmbeddingScheduler started')
    this.schedulePoll()
  }

  /** 停止轮询 */
  stop(): void {
    this.running = false
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }
    log('EmbeddingScheduler stopped')
  }

  /** 外部触发（收到 kg:trigger-embedding） */
  trigger(config: EmbeddingConfig, target: TargetInfo): void {
    this.embeddingConfig = config
    this.targetInfo = target
    // 清空 HNSW 缓存（可能换了目标库）
    this.hnswCreatedSet.clear()
    this.entityCompletedCount = 0
    this.entityPendingCount = 0
    this.entityTotalCount = 0
    this.relationCompletedCount = 0
    this.relationPendingCount = 0
    this.relationTotalCount = 0
    this.lastError = null
    this.lastBatchInfo = null

    log('Trigger received', { target: target.graphTableBase, model: config.model })

    // 立即切换到 active，无需等待下次轮询
    if (this.state === 'idle' || this.state === 'error') {
      this.setState('active', 'trigger received')
      // 取消当前定时器，立即开始处理
      if (this.pollTimer) {
        clearTimeout(this.pollTimer)
        this.pollTimer = null
      }
      if (!this.isProcessing) {
        // 先创建 HNSW 索引再开始嵌入，这样每次写入 embedding 时
        // SurrealDB 会增量构建索引，而不是最后全量构建
        void this.ensureHnswIndex().then(() => this.poll())
      }
    }
  }

  private async writeRelationBatchToDb(
    relations: RelationRow[],
    texts: string[],
    vectors: number[][]
  ): Promise<void> {
    if (!this.targetInfo) return

    const { namespace, database } = this.targetInfo

    const statements = relations.map((relation, i) => {
      const hash = createHash('sha256').update(texts[i], 'utf8').digest('hex').slice(0, 16)
      const vecStr = `[${vectors[i].join(',')}]`
      return `UPDATE ${relation.id} SET embedding = ${vecStr}, embedding_hash = '${hash}', embedding_at = time::now();`
    })

    const sql = statements.join('\n')

    try {
      await this.client.queryInDatabase(namespace, database, sql)
    } catch (error) {
      logError('writeRelationBatchToDb failed', error)
      throw error
    }
  }

  /** 查询当前状态 */
  getStatus(): EmbeddingStatus {
    const entityHnswIndexReady = this.isEntityHnswIndexReady()
    const relationHnswIndexReady = this.isRelationHnswIndexReady()
    return {
      state: this.state,
      completed: this.getCompletedTotal(),
      pending: this.getPendingTotal(),
      total: this.getTotalCount(),
      hnswIndexReady: entityHnswIndexReady && relationHnswIndexReady,
      entityCompleted: this.entityCompletedCount,
      entityPending: this.entityPendingCount,
      entityTotal: this.entityTotalCount,
      relationCompleted: this.relationCompletedCount,
      relationPending: this.relationPendingCount,
      relationTotal: this.relationTotalCount,
      entityHnswIndexReady,
      relationHnswIndexReady,
      lastError: this.lastError,
      lastBatchInfo: this.lastBatchInfo
    }
  }

  // ==========================================================================
  // 启动自检：发现未完成嵌入 → 通知主进程重发 trigger
  // ==========================================================================

  async selfCheck(): Promise<void> {
    if (!this.client.isConnected()) {
      log('selfCheck skipped: not connected')
      return
    }

    try {
      // 从 kg_build_task 中获取 distinct 的目标库信息
      const rows = this.client.extractRecords(
        await this.client.query(
          `SELECT
             target_namespace,
             target_database,
             target_table_base,
             config.embeddingConfigId AS embedding_config_id
           FROM kg_build_task
           WHERE status = 'completed'
             AND target_namespace IS NOT NONE
             AND target_table_base IS NOT NONE
           GROUP BY target_namespace, target_database, target_table_base, config.embeddingConfigId;`
        )
      )

      if (rows.length === 0) {
        log('selfCheck: no completed build tasks found, nothing to recover')
        return
      }

      const items: KGEmbeddingRecoveryItem[] = []

      for (const row of rows) {
        const ns = String(row.target_namespace ?? '')
        const db = String(row.target_database ?? '')
        const base = String(row.target_table_base ?? '')
        const configId = String(row.embedding_config_id ?? '')

        if (!ns || !db || !base || !configId) continue

        // 切到目标库查询未嵌入的实体/关系数量
        const tables = getKgTableNames(base)
        try {
          const countResult = this.client.extractRecords(
            await this.client.queryInDatabase(
              ns,
              db,
              `SELECT
                 (SELECT count() FROM ${tables.entity} WHERE embedding IS NONE GROUP ALL)[0].count ?? 0 AS entity_pending,
                 (SELECT count() FROM ${tables.relates} WHERE embedding IS NONE GROUP ALL)[0].count ?? 0 AS relation_pending;`
            )
          )

          const entityPending = Number(countResult[0]?.entity_pending) || 0
          const relationPending = Number(countResult[0]?.relation_pending) || 0
          const totalPending = entityPending + relationPending

          if (totalPending > 0) {
            items.push({
              targetNamespace: ns,
              targetDatabase: db,
              graphTableBase: base,
              embeddingConfigId: configId,
              pendingCount: totalPending
            })
            log('selfCheck: found pending embeddings', {
              db,
              base,
              entityPending,
              relationPending
            })
          }
        } catch (err) {
          // 目标库表可能不存在（被删除了），跳过
          log(`selfCheck: skipped ${base} in ${db} (table may not exist)`)
        }
      }

      if (items.length > 0) {
        log(`selfCheck: requesting recovery for ${items.length} target(s)`)
        this.sendMessage({ type: 'kg:embedding-recovery-needed', items })
      } else {
        log('selfCheck: all embeddings are complete, no recovery needed')
      }
    } catch (error) {
      logError('selfCheck failed', error)
    }
  }

  // ==========================================================================
  // 状态机
  // ==========================================================================

  private setState(newState: SchedulerState, reason: string): void {
    const oldState = this.state
    if (oldState === newState) return
    this.state = newState
    log(`State: ${oldState} → ${newState}`, { reason, pending: this.getPendingTotal() })
  }

  // ==========================================================================
  // 轮询调度（setTimeout 避免重叠）
  // ==========================================================================

  private schedulePoll(): void {
    if (!this.running) return
    const interval = this.state === 'active' ? this.ACTIVE_POLL_INTERVAL : this.IDLE_POLL_INTERVAL
    this.pollTimer = setTimeout(() => void this.poll(), interval)
  }

  // ==========================================================================
  // poll() 主循环
  // ==========================================================================

  private async poll(): Promise<void> {
    if (this.isProcessing || !this.running) {
      this.schedulePoll()
      return
    }
    this.isProcessing = true

    try {
      if (!this.client.isConnected() || !this.targetInfo || !this.embeddingConfig) {
        // 无配置或未连接，保持 idle
        return
      }

      if (this.state === 'idle' || this.state === 'error') {
        // idle/error 态：扫描实体/关系是否有待嵌入
        const [pendingEntities, pendingRelations] = await Promise.all([
          this.scanPendingEntities(),
          this.scanPendingRelations()
        ])

        if (pendingEntities.length > 0 || pendingRelations.length > 0) {
          this.setState(
            'active',
            `found pending entities=${pendingEntities.length}, relations=${pendingRelations.length}`
          )

          if (pendingEntities.length > 0) {
            await this.processEntityBatch(pendingEntities)
          }
          if (pendingRelations.length > 0) {
            await this.processRelationBatch(pendingRelations)
          }
        }
      } else if (this.state === 'active') {
        // active 态：并列处理实体/关系批次
        const [pendingEntities, pendingRelations] = await Promise.all([
          this.scanPendingEntities(),
          this.scanPendingRelations()
        ])

        let hasWork = false
        if (pendingEntities.length > 0) {
          hasWork = true
          await this.processEntityBatch(pendingEntities)
        }
        if (pendingRelations.length > 0) {
          hasWork = true
          await this.processRelationBatch(pendingRelations)
        }

        if (!hasWork) {
          // 所有实体/关系处理完毕 → indexing 阶段
          await this.doIndexing()
        }
      }

      // 每次循环发送进度消息
      this.sendProgressMessage()
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      this.lastError = errMsg
      logError('Poll error', error)
      if (this.state === 'active') {
        this.setState('error', errMsg)
      }
    } finally {
      this.isProcessing = false
      this.schedulePoll()
    }
  }

  // ==========================================================================
  // indexing 阶段
  // ==========================================================================

  private async doIndexing(): Promise<void> {
    log('All entities/relations embedded, verifying HNSW indexes...')
    // 兜底：确认索引存在（正常情况下 trigger 时已创建）
    await this.ensureHnswIndex()
    this.setState('idle', 'embedding complete, HNSW indexes verified')
  }

  // ==========================================================================
  // scanPendingEntities
  // ==========================================================================

  private async scanPendingEntities(): Promise<EntityRow[]> {
    if (!this.targetInfo || !this.embeddingConfig) return []

    const { namespace, database, graphTableBase } = this.targetInfo
    const { batchSize } = this.embeddingConfig
    const entityTable = getKgTableNames(graphTableBase).entity

    try {
      // 先查总数和已完成数（用于进度报告）
      const countResult = this.client.extractRecords(
        await this.client.queryInDatabase(
          namespace,
          database,
          `SELECT
             count() AS total,
             math::sum(IF embedding IS NONE THEN 0 ELSE 1 END) AS completed
           FROM ${entityTable} GROUP ALL;`
        )
      )

      if (countResult.length > 0) {
        this.entityTotalCount = Number(countResult[0].total) || 0
        this.entityCompletedCount = Number(countResult[0].completed) || 0
        this.entityPendingCount = Math.max(0, this.entityTotalCount - this.entityCompletedCount)
      }

      // 查询待嵌入实体
      const rows = this.client.extractRecords(
        await this.client.queryInDatabase(
          namespace,
          database,
          `SELECT id, entity_name, description
           FROM ${entityTable}
           WHERE embedding IS NONE
           LIMIT ${batchSize};`
        )
      )

      return rows.map((r: any) => ({
        id: String(r.id),
        entity_name: String(r.entity_name ?? ''),
        description: String(r.description ?? '')
      }))
    } catch (error) {
      logError('scanPendingEntities failed', error)
      return []
    }
  }

  // ==========================================================================
  // scanPendingRelations
  // ==========================================================================

  private async scanPendingRelations(): Promise<RelationRow[]> {
    if (!this.targetInfo || !this.embeddingConfig) return []

    const { namespace, database, graphTableBase } = this.targetInfo
    const { batchSize } = this.embeddingConfig
    const relationTable = getKgTableNames(graphTableBase).relates

    try {
      const countResult = this.client.extractRecords(
        await this.client.queryInDatabase(
          namespace,
          database,
          `SELECT
             count() AS total,
             math::sum(IF embedding IS NONE THEN 0 ELSE 1 END) AS completed
           FROM ${relationTable} GROUP ALL;`
        )
      )

      if (countResult.length > 0) {
        this.relationTotalCount = Number(countResult[0].total) || 0
        this.relationCompletedCount = Number(countResult[0].completed) || 0
        this.relationPendingCount = Math.max(
          0,
          this.relationTotalCount - this.relationCompletedCount
        )
      }

      const rows = this.client.extractRecords(
        await this.client.queryInDatabase(
          namespace,
          database,
          `SELECT id, keywords, description, meta::id(in) AS source, meta::id(out) AS target
           FROM ${relationTable}
           WHERE embedding IS NONE
           LIMIT ${batchSize};`
        )
      )

      return rows.map((r: any) => ({
        id: String(r.id),
        keywords: String(r.keywords ?? ''),
        description: String(r.description ?? ''),
        source: String(r.source ?? ''),
        target: String(r.target ?? '')
      }))
    } catch (error) {
      logError('scanPendingRelations failed', error)
      return []
    }
  }

  // ==========================================================================
  // processEntityBatch
  // ==========================================================================

  private async processEntityBatch(entities: EntityRow[]): Promise<void> {
    if (!this.embeddingConfig) return

    const startTime = Date.now()
    const { maxTokens } = this.embeddingConfig

    try {
      // 1. 构造嵌入文本
      const texts = entities.map((e) => buildEmbeddingText(e.entity_name, e.description, maxTokens))

      // 2. 调用嵌入 API
      const vectors = await this.callEmbeddingAPI(texts)

      // 3. 原子性检查：向量数组长度必须与实体数量匹配
      if (vectors.length !== entities.length) {
        const errMsg = `Vector count mismatch: expected ${entities.length}, got ${vectors.length}`
        logError(errMsg)
        this.lastError = errMsg
        this.lastBatchInfo = {
          target: 'entity',
          successCount: 0,
          failCount: entities.length,
          durationMs: Date.now() - startTime,
          remaining: this.getPendingTotal()
        }
        return
      }

      // 4. 批量写入数据库
      await this.writeEntityBatchToDb(entities, texts, vectors)

      const durationMs = Date.now() - startTime
      // 更新待处理数
      this.entityPendingCount = Math.max(0, this.entityPendingCount - entities.length)
      this.entityCompletedCount += entities.length

      this.lastBatchInfo = {
        target: 'entity',
        successCount: entities.length,
        failCount: 0,
        durationMs,
        remaining: this.getPendingTotal()
      }

      log('Batch complete', this.lastBatchInfo)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      this.lastError = errMsg
      logError('processBatch failed', error)

      this.lastBatchInfo = {
        target: 'entity',
        successCount: 0,
        failCount: entities.length,
        durationMs: Date.now() - startTime,
        remaining: this.getPendingTotal()
      }

      // API 连续失败 → error 状态
      this.setState('error', errMsg)
    }
  }

  // ==========================================================================
  // processRelationBatch
  // ==========================================================================

  private async processRelationBatch(relations: RelationRow[]): Promise<void> {
    if (!this.embeddingConfig) return

    const startTime = Date.now()
    const { maxTokens } = this.embeddingConfig

    try {
      const texts = relations.map((r) =>
        buildRelationEmbeddingText(r.source, r.target, r.keywords, r.description, maxTokens)
      )

      const vectors = await this.callEmbeddingAPI(texts)

      if (vectors.length !== relations.length) {
        const errMsg = `Vector count mismatch: expected ${relations.length}, got ${vectors.length}`
        logError(errMsg)
        this.lastError = errMsg
        this.lastBatchInfo = {
          target: 'relation',
          successCount: 0,
          failCount: relations.length,
          durationMs: Date.now() - startTime,
          remaining: this.getPendingTotal()
        }
        return
      }

      await this.writeRelationBatchToDb(relations, texts, vectors)

      const durationMs = Date.now() - startTime
      this.relationPendingCount = Math.max(0, this.relationPendingCount - relations.length)
      this.relationCompletedCount += relations.length

      this.lastBatchInfo = {
        target: 'relation',
        successCount: relations.length,
        failCount: 0,
        durationMs,
        remaining: this.getPendingTotal()
      }

      log('Relation batch complete', this.lastBatchInfo)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      this.lastError = errMsg
      logError('processRelationBatch failed', error)

      this.lastBatchInfo = {
        target: 'relation',
        successCount: 0,
        failCount: relations.length,
        durationMs: Date.now() - startTime,
        remaining: this.getPendingTotal()
      }

      this.setState('error', errMsg)
    }
  }

  // ==========================================================================
  // writeBatchToDb
  // ==========================================================================

  private async writeEntityBatchToDb(
    entities: EntityRow[],
    texts: string[],
    vectors: number[][]
  ): Promise<void> {
    if (!this.targetInfo) return

    const { namespace, database } = this.targetInfo

    // 拼接所有 UPDATE 语句，一次性执行
    const statements = entities.map((entity, i) => {
      const hash = createHash('sha256').update(texts[i], 'utf8').digest('hex').slice(0, 16)
      const vecStr = `[${vectors[i].join(',')}]`
      // entity.id 已经是 "table:record_id" 格式
      return `UPDATE ${entity.id} SET embedding = ${vecStr}, embedding_hash = '${hash}', embedding_at = time::now();`
    })

    const sql = statements.join('\n')

    try {
      await this.client.queryInDatabase(namespace, database, sql)
    } catch (error) {
      logError('writeBatchToDb failed', error)
      throw error
    }
  }

  // ==========================================================================
  // callEmbeddingAPI
  // ==========================================================================

  private async callEmbeddingAPI(texts: string[]): Promise<number[][]> {
    if (!this.embeddingConfig) throw new Error('No embedding config')

    const { baseUrl, apiKey, model, dimensions } = this.embeddingConfig
    const url = `${baseUrl.replace(/\/$/, '')}/v1/embeddings`

    const body = {
      model,
      input: texts,
      dimensions
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.API_TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })

      let data: EmbeddingAPIResponse | null = null
      try {
        data = (await response.json()) as EmbeddingAPIResponse
      } catch {
        data = null
      }

      if (!response.ok) {
        const errorMessage =
          data?.error?.message ??
          (data ? JSON.stringify(data) : '') ??
          `HTTP ${response.status} ${response.statusText}`
        throw new Error(errorMessage)
      }

      if (!data?.data || data.data.length === 0) {
        throw new Error('Empty embedding response')
      }

      // 按 index 排序（API 可能乱序返回）
      const sorted = [...data.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      return sorted.map((item) => item.embedding)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Embedding API request timeout (30s)')
      }
      throw err
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // ==========================================================================
  // ensureHnswIndex
  // ==========================================================================

  private async ensureHnswIndex(): Promise<void> {
    if (!this.targetInfo || !this.embeddingConfig) return

    const { namespace, database, graphTableBase } = this.targetInfo
    const { dimensions } = this.embeddingConfig
    const tables = getKgTableNames(graphTableBase)
    const targetTables = [tables.entity, tables.relates]

    for (const tableName of targetTables) {
      if (this.hnswCreatedSet.has(tableName)) continue

      const sql = `DEFINE INDEX IF NOT EXISTS idx_${tableName}_embedding ON ${tableName} FIELDS embedding HNSW DIMENSION ${dimensions} DIST COSINE CONCURRENTLY;`

      try {
        await this.client.queryInDatabase(namespace, database, sql)
        this.hnswCreatedSet.add(tableName)
        log('HNSW index created', { tableName, dimensions })
      } catch (error) {
        logError('ensureHnswIndex failed', error)
      }
    }
  }

  private getCompletedTotal(): number {
    return this.entityCompletedCount + this.relationCompletedCount
  }

  private getPendingTotal(): number {
    return this.entityPendingCount + this.relationPendingCount
  }

  private getTotalCount(): number {
    return this.entityTotalCount + this.relationTotalCount
  }

  private isEntityHnswIndexReady(): boolean {
    if (!this.targetInfo) return false
    const entityTable = getKgTableNames(this.targetInfo.graphTableBase).entity
    return this.hnswCreatedSet.has(entityTable)
  }

  private isRelationHnswIndexReady(): boolean {
    if (!this.targetInfo) return false
    const relationTable = getKgTableNames(this.targetInfo.graphTableBase).relates
    return this.hnswCreatedSet.has(relationTable)
  }

  // ==========================================================================
  // 进度消息
  // ==========================================================================

  private sendProgressMessage(): void {
    const entityHnswIndexReady = this.isEntityHnswIndexReady()
    const relationHnswIndexReady = this.isRelationHnswIndexReady()

    const data: KGEmbeddingProgressData = {
      state: this.state,
      completed: this.getCompletedTotal(),
      pending: this.getPendingTotal(),
      total: this.getTotalCount(),
      hnswIndexReady: entityHnswIndexReady && relationHnswIndexReady,
      entityCompleted: this.entityCompletedCount,
      entityPending: this.entityPendingCount,
      entityTotal: this.entityTotalCount,
      relationCompleted: this.relationCompletedCount,
      relationPending: this.relationPendingCount,
      relationTotal: this.relationTotalCount,
      entityHnswIndexReady,
      relationHnswIndexReady,
      lastError: this.lastError,
      lastBatchInfo: this.lastBatchInfo
    }

    this.sendMessage({ type: 'kg:embedding-progress', data })
  }
}

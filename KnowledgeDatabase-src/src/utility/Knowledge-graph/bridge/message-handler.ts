/**
 * @file 消息路由
 * @description 解析 Main → KG 消息，分发到各 service/core
 */

import type { KGSurrealClient } from '../db/surreal-client'
import type { TaskSubmissionService } from '../service/task-submission'
import type { TaskScheduler } from '../core/task-scheduler'
import type { GraphBuildScheduler } from '../core/graph-build-scheduler'
import type { GraphQueryService } from '../service/graph-query'
import type {
  MainToKGMessage,
  KGToMainMessage,
  KGDBConfig,
  KGCreateSchemaParams,
  KGGraphQueryParams
} from '@shared/knowledge-graph-ipc.types'
import { createGraphSchema } from '../service/graph-schema'

// ============================================================================
// 日志
// ============================================================================

const log = (msg: string, data?: any): void => {
  if (data) {
    console.log(`[KG-MessageHandler] ${msg}`, data)
  } else {
    console.log(`[KG-MessageHandler] ${msg}`)
  }
}

const logError = (msg: string, error?: any): void => {
  console.error(`[KG-MessageHandler] ${msg}`, error)
}

function rid(id: any): string {
  if (typeof id === 'string') return id
  if (id && typeof id.toString === 'function') return id.toString()
  return String(id)
}

// ============================================================================
// MessageHandler
// ============================================================================

export class MessageHandler {
  private client: KGSurrealClient
  private taskSubmission: TaskSubmissionService
  private scheduler: TaskScheduler
  private graphBuildScheduler: GraphBuildScheduler
  private graphQueryService: GraphQueryService
  private sendMessage: (msg: KGToMainMessage) => void

  constructor(
    client: KGSurrealClient,
    taskSubmission: TaskSubmissionService,
    scheduler: TaskScheduler,
    graphBuildScheduler: GraphBuildScheduler,
    graphQueryService: GraphQueryService,
    sendMessage: (msg: KGToMainMessage) => void
  ) {
    this.client = client
    this.taskSubmission = taskSubmission
    this.scheduler = scheduler
    this.graphBuildScheduler = graphBuildScheduler
    this.graphQueryService = graphQueryService
    this.sendMessage = sendMessage
  }

  /**
   * 处理来自主进程的消息
   */
  async handle(msg: MainToKGMessage): Promise<void> {
    log(`Received: ${msg.type}`, msg)

    try {
      switch (msg.type) {
        case 'kg:init':
          await this.handleInit(msg.dbConfig)
          break

        case 'kg:submit-task':
          log(`submit-task data:`, msg.data)
          await this.handleSubmitTask(msg.requestId, msg.data)
          break

        case 'kg:query-status':
          await this.handleQueryStatus(msg.requestId)
          break
        case 'kg:update-model-providers':
          this.scheduler.updateProviders(msg.providers ?? [])
          break

        case 'kg:create-graph-schema':
          await this.handleCreateGraphSchema(msg.requestId, msg.data)
          break

        case 'kg:query-build-status':
          await this.handleQueryBuildStatus(msg.requestId)
          break

        case 'kg:query-graph-data':
          this.handleQueryGraphData(msg.requestId, msg.data)
          break

        case 'kg:cancel-graph-query':
          this.handleCancelGraphQuery(msg.sessionId)
          break

        default:
          log(`Unknown message type: ${(msg as any).type}`)
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logError(`Error handling ${msg.type}: ${errMsg}`, error)
    }
  }

  // ==========================================================================
  // 消息处理
  // ==========================================================================

  private async handleInit(dbConfig: KGDBConfig): Promise<void> {
    try {
      await this.client.connect(dbConfig)
      // 确保 schema 存在
      await this.taskSubmission.ensureSchema()
      // 启动调度器
      await this.scheduler.start()
      await this.graphBuildScheduler.start()
      // init 完成后立刻触发一次调度，避免等待轮询间隔
      this.scheduler.kick()
      this.graphBuildScheduler.kick()
      this.sendMessage({ type: 'kg:init-result', success: true })
      log('Initialized successfully')
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logError('Init failed', error)
      this.sendMessage({ type: 'kg:init-result', success: false, error: errMsg })
    }
  }

  private async handleSubmitTask(
    requestId: string,
    data: import('@shared/knowledge-graph-ipc.types').KGSubmitTaskParams
  ): Promise<void> {
    try {
      const result = await this.taskSubmission.submitTask(data)
      this.sendMessage({
        type: 'kg:task-created',
        requestId,
        taskId: result.taskId,
        chunksTotal: result.chunksTotal
      })
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logError('Submit task failed', error)
      this.sendMessage({
        type: 'kg:task-error',
        requestId,
        error: errMsg
      })
    }
  }

  private async handleQueryStatus(requestId: string): Promise<void> {
    try {
      const result = this.client.extractRecords(
        await this.client.query(`SELECT * FROM kg_task ORDER BY created_at DESC LIMIT 50;`)
      )

      const tasks = result.map((t: any) => ({
        taskId: rid(t.id),
        fileKey: t.file_key,
        status: t.status,
        chunksTotal: t.chunks_total_origin ?? t.chunks_total,
        chunksCompleted: t.chunks_completed,
        chunksFailed: t.chunks_failed
      }))

      this.sendMessage({ type: 'kg:status', requestId, tasks })
    } catch (error) {
      logError('Query status failed', error)
      this.sendMessage({ type: 'kg:status', requestId, tasks: [] })
    }
  }

  private async handleCreateGraphSchema(
    requestId: string,
    data: KGCreateSchemaParams
  ): Promise<void> {
    try {
      const tables = await createGraphSchema(
        this.client,
        data.targetNamespace,
        data.targetDatabase,
        data.graphTableBase
      )
      this.sendMessage({ type: 'kg:schema-created', requestId, tables })
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logError('Create graph schema failed', error)
      this.sendMessage({ type: 'kg:schema-error', requestId, error: errMsg })
    }
  }

  private async handleQueryBuildStatus(requestId: string): Promise<void> {
    try {
      const result = this.client.extractRecords(
        await this.client.query(`SELECT * FROM kg_build_task ORDER BY created_at DESC LIMIT 50;`)
      )

      const tasks = result.map((t: any) => ({
        taskId: rid(t.id),
        sourceTaskId: t.source_task_id ?? '',
        fileKey: t.file_key ?? '',
        status: t.status,
        chunksTotal: t.chunks_total,
        chunksCompleted: t.chunks_completed,
        chunksFailed: t.chunks_failed,
        entitiesUpserted: t.entities_upserted,
        relationsUpserted: t.relations_upserted
      }))

      this.sendMessage({ type: 'kg:build-status', requestId, tasks })
    } catch (error) {
      logError('Query build status failed', error)
      this.sendMessage({ type: 'kg:build-status', requestId, tasks: [] })
    }
  }

  // ==========================================================================
  // 图谱数据流式查询
  // ==========================================================================

  private handleQueryGraphData(requestId: string, data: KGGraphQueryParams): void {
    // 参数校验
    if (!data.targetNamespace || !data.targetDatabase || !data.graphTableBase) {
      this.sendMessage({
        type: 'kg:graph-data-error',
        sessionId: requestId,
        error: 'Missing required parameters: targetNamespace, targetDatabase, or graphTableBase'
      })
      return
    }

    try {
      const sessionId = this.graphQueryService.startQuery(data)
      this.sendMessage({
        type: 'kg:graph-query-started',
        requestId,
        sessionId
      })
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logError('Start graph query failed', error)
      this.sendMessage({
        type: 'kg:graph-data-error',
        sessionId: requestId,
        error: errMsg
      })
    }
  }

  private handleCancelGraphQuery(sessionId: string): void {
    this.graphQueryService.cancelQuery(sessionId)
  }
}

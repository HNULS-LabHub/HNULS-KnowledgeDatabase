/**
 * @file 消息路由
 * @description 解析 Main → KG 消息，分发到各 service/core
 */

import type { KGSurrealClient } from '../db/surreal-client'
import type { TaskSubmissionService } from '../service/task-submission'
import type { TaskScheduler } from '../core/task-scheduler'
import type {
  MainToKGMessage,
  KGToMainMessage,
  KGDBConfig
} from '@shared/knowledge-graph-ipc.types'

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
  private sendMessage: (msg: KGToMainMessage) => void

  constructor(
    client: KGSurrealClient,
    taskSubmission: TaskSubmissionService,
    scheduler: TaskScheduler,
    sendMessage: (msg: KGToMainMessage) => void
  ) {
    this.client = client
    this.taskSubmission = taskSubmission
    this.scheduler = scheduler
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
      // init 完成后立刻触发一次调度，避免等待轮询间隔
      this.scheduler.kick()
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
        await this.client.query(
          `SELECT * FROM kg_task ORDER BY created_at DESC LIMIT 50;`
        )
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
}

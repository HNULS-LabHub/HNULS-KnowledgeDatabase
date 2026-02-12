/**
 * @file 知识图谱通信桥
 * @description Main 进程与 Utility Process (Knowledge-graph) 之间的通信桥
 */

import { utilityProcess } from 'electron'
import type { UtilityProcess } from 'electron'
import path from 'path'
import type {
  MainToKGMessage,
  KGToMainMessage,
  KGDBConfig,
  KGSubmitTaskParams,
  KGTaskStatus
} from '@shared/knowledge-graph-ipc.types'
import { logger } from '../logger'

// ============================================================================
// 类型定义
// ============================================================================

interface PendingRequest<T> {
  resolve: (value: T) => void
  reject: (error: Error) => void
  timeoutId: NodeJS.Timeout
}

// ============================================================================
// KnowledgeGraphBridge
// ============================================================================

export class KnowledgeGraphBridge {
  private process: UtilityProcess | null = null
  private pendingRequests: Map<string, PendingRequest<any>> = new Map()
  private isReady = false
  private readyPromise: Promise<void> | null = null
  private readyResolve: (() => void) | null = null
  private currentConcurrency = 5

  /** 初始化完成 Promise */
  private initPromise: Promise<void> | null = null
  private initResolve: (() => void) | null = null
  private initReject: ((error: Error) => void) | null = null

  /** 事件监听器 */
  private taskCompletedListeners: Set<(taskId: string) => void> = new Set()
  private taskFailedListeners: Set<(taskId: string, error: string) => void> = new Set()
  private taskProgressListeners: Set<
    (taskId: string, completed: number, failed: number, total: number) => void
  > = new Set()

  // ==========================================================================
  // 生命周期
  // ==========================================================================

  /**
   * 启动 utility process
   */
  async start(): Promise<void> {
    if (this.process) {
      logger.info('[KnowledgeGraphBridge] Already started')
      return
    }

    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve
    })

    const modulePath = path.join(__dirname, 'utility/knowledge-graph.js')
    logger.info('[KnowledgeGraphBridge] Spawning utility process:', modulePath)

    this.process = utilityProcess.fork(modulePath)

    this.process.on('message', (msg: KGToMainMessage) => {
      this.handleMessage(msg)
    })

    this.process.on('exit', (code) => {
      logger.info('[KnowledgeGraphBridge] Process exited with code:', code)
      this.process = null
      this.isReady = false
    })

    this.process.on('spawn', () => {
      logger.info('[KnowledgeGraphBridge] Process spawned successfully')
    })

    await this.readyPromise
    logger.info('[KnowledgeGraphBridge] Ready')
  }

  /**
   * 停止 utility process
   */
  stop(): void {
    if (this.process) {
      this.process.kill()
      this.process = null
      this.isReady = false
    }
  }

  // ==========================================================================
  // 初始化数据库连接
  // ==========================================================================

  /**
   * 初始化子进程的数据库连接
   */
  async initialize(dbConfig: KGDBConfig): Promise<void> {
    if (!this.process || !this.isReady) {
      throw new Error('KnowledgeGraph process not ready')
    }

    this.initPromise = new Promise((resolve, reject) => {
      this.initResolve = resolve
      this.initReject = reject
    })

    this.sendToProcess({ type: 'kg:init', dbConfig })

    await this.initPromise
  }

  // ==========================================================================
  // 业务 API
  // ==========================================================================

  /**
   * 提交知识图谱构建任务
   */
  async submitTask(params: KGSubmitTaskParams): Promise<{ taskId: string; chunksTotal: number }> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    return this.sendRequest<{ taskId: string; chunksTotal: number }>(requestId, {
      type: 'kg:submit-task',
      requestId,
      data: params
    })
  }

  /**
   * 更新最大并行数
   */
  updateConcurrency(maxConcurrency: number): void {
    this.currentConcurrency = Math.max(1, maxConcurrency)
    this.sendToProcess({ type: 'kg:update-concurrency', maxConcurrency })
  }

  /**
   * 查询所有任务状态
   */
  async queryStatus(): Promise<KGTaskStatus[]> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    return this.sendRequest<KGTaskStatus[]>(requestId, {
      type: 'kg:query-status',
      requestId
    })
  }

  // ==========================================================================
  // 事件监听
  // ==========================================================================

  onTaskCompleted(listener: (taskId: string) => void): () => void {
    this.taskCompletedListeners.add(listener)
    return () => this.taskCompletedListeners.delete(listener)
  }

  onTaskFailed(listener: (taskId: string, error: string) => void): () => void {
    this.taskFailedListeners.add(listener)
    return () => this.taskFailedListeners.delete(listener)
  }

  onTaskProgress(
    listener: (taskId: string, completed: number, failed: number, total: number) => void
  ): () => void {
    this.taskProgressListeners.add(listener)
    return () => this.taskProgressListeners.delete(listener)
  }

  // ==========================================================================
  // 消息处理
  // ==========================================================================

  private handleMessage(msg: KGToMainMessage): void {
    switch (msg.type) {
      case 'kg:ready':
        this.isReady = true
        this.readyResolve?.()
        break

      case 'kg:init-result':
        if (msg.success) {
          this.initResolve?.()
        } else {
          this.initReject?.(new Error(msg.error ?? 'Init failed'))
        }
        this.initPromise = null
        break

      case 'kg:task-created': {
        const pending = this.pendingRequests.get(msg.requestId)
        if (pending) {
          clearTimeout(pending.timeoutId)
          this.pendingRequests.delete(msg.requestId)
          pending.resolve({ taskId: msg.taskId, chunksTotal: msg.chunksTotal })
        }
        break
      }

      case 'kg:task-error': {
        const pending = this.pendingRequests.get(msg.requestId)
        if (pending) {
          clearTimeout(pending.timeoutId)
          this.pendingRequests.delete(msg.requestId)
          pending.reject(new Error(msg.error))
        }
        break
      }

      case 'kg:task-progress':
        for (const listener of this.taskProgressListeners) {
          listener(msg.taskId, msg.completed, msg.failed, msg.total)
        }
        break

      case 'kg:task-completed':
        for (const listener of this.taskCompletedListeners) {
          listener(msg.taskId)
        }
        break

      case 'kg:task-failed':
        for (const listener of this.taskFailedListeners) {
          listener(msg.taskId, msg.error)
        }
        break

      case 'kg:status': {
        const pending = this.pendingRequests.get(msg.requestId)
        if (pending) {
          clearTimeout(pending.timeoutId)
          this.pendingRequests.delete(msg.requestId)
          pending.resolve(msg.tasks)
        }
        break
      }

      case 'kg:log':
        this.handleLog(msg.level, msg.message, msg.meta)
        break
      case 'kg:request-concurrency':
        this.sendToProcess({ type: 'kg:concurrency-response', value: this.currentConcurrency })
        break

      default:
        logger.warn('[KnowledgeGraphBridge] Unknown message type:', (msg as any).type)
    }
  }

  private handleLog(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: any): void {
    const prefix = '[KG-Process]'
    switch (level) {
      case 'debug':
        logger.debug(`${prefix} ${message}`, meta)
        break
      case 'info':
        logger.info(`${prefix} ${message}`, meta)
        break
      case 'warn':
        logger.warn(`${prefix} ${message}`, meta)
        break
      case 'error':
        logger.error(`${prefix} ${message}`, meta)
        break
    }
  }

  // ==========================================================================
  // 内部工具
  // ==========================================================================

  private sendToProcess(msg: MainToKGMessage): void {
    if (!this.process) {
      throw new Error('KnowledgeGraph process not running')
    }
    this.process.postMessage(msg)
  }

  private sendRequest<T>(requestId: string, msg: MainToKGMessage, timeout = 30000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error(`Request ${requestId} timed out after ${timeout}ms`))
      }, timeout)

      this.pendingRequests.set(requestId, { resolve, reject, timeoutId })
      this.sendToProcess(msg)
    })
  }
}

// ============================================================================
// 单例导出
// ============================================================================

export const knowledgeGraphBridge = new KnowledgeGraphBridge()

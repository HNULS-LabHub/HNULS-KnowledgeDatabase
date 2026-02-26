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
  KGTaskStatus,
  KGModelProviderConfig,
  KGCreateSchemaParams,
  KGBuildTaskStatus,
  KGGraphQueryParams,
  KGGraphEntity,
  KGGraphRelation,
  KGGraphDataProgress,
  KGTriggerEmbeddingParams,
  KGEmbeddingProgressData,
  KGEmbeddingRecoveryItem,
  KGRetrievalParams,
  KGRetrievalResult
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

/** 图谱数据批次事件 */
export interface GraphDataBatchEvent {
  sessionId: string
  entities: KGGraphEntity[]
  relations: KGGraphRelation[]
  progress: KGGraphDataProgress
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
  private pendingProviders: KGModelProviderConfig[] | null = null

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
  private buildProgressListeners: Set<
    (
      taskId: string,
      completed: number,
      failed: number,
      total: number,
      entitiesTotal: number,
      relationsTotal: number
    ) => void
  > = new Set()
  private buildCompletedListeners: Set<
    (
      taskId: string,
      targetNamespace?: string,
      targetDatabase?: string,
      graphTableBase?: string,
      embeddingConfigId?: string
    ) => void
  > = new Set()
  private buildFailedListeners: Set<(taskId: string, error: string) => void> = new Set()

  /** 图谱数据查询事件监听器 */
  private graphDataBatchListeners: Set<(data: GraphDataBatchEvent) => void> = new Set()
  private graphDataCompleteListeners: Set<(sessionId: string) => void> = new Set()
  private graphDataErrorListeners: Set<(sessionId: string, error: string) => void> = new Set()
  private graphDataCancelledListeners: Set<(sessionId: string) => void> = new Set()

  /** 嵌入进度事件监听器 */
  private embeddingProgressListeners: Set<(data: KGEmbeddingProgressData) => void> = new Set()

  /** 嵌入恢复事件监听器 */
  private embeddingRecoveryListeners: Set<(items: KGEmbeddingRecoveryItem[]) => void> = new Set()

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
   * 更新 LLM Provider 配置
   */
  updateModelProviders(providers: KGModelProviderConfig[]): void {
    this.pendingProviders = providers
    if (!this.process || !this.isReady) {
      return
    }
    this.sendToProcess({ type: 'kg:update-model-providers', providers })
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

  /**
   * 创建图谱表 Schema
   */
  async createGraphSchema(params: KGCreateSchemaParams): Promise<string[]> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    return this.sendRequest<string[]>(requestId, {
      type: 'kg:create-graph-schema',
      requestId,
      data: params
    })
  }

  /**
   * 查询图谱构建任务状态
   */
  async queryBuildStatus(): Promise<KGBuildTaskStatus[]> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    return this.sendRequest<KGBuildTaskStatus[]>(requestId, {
      type: 'kg:query-build-status',
      requestId
    })
  }

  /**
   * 查询图谱数据（流式）
   * @returns sessionId 用于后续取消或识别事件
   */
  async queryGraphData(params: KGGraphQueryParams): Promise<string> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    return this.sendRequest<string>(requestId, {
      type: 'kg:query-graph-data',
      requestId,
      data: params
    })
  }

  /**
   * 取消图谱数据查询
   */
  cancelGraphQuery(sessionId: string): void {
    this.sendToProcess({ type: 'kg:cancel-graph-query', sessionId })
  }

  /**
   * 触发嵌入任务
   */
  triggerEmbedding(params: KGTriggerEmbeddingParams): void {
    this.sendToProcess({ type: 'kg:trigger-embedding', data: params })
  }

  /**
   * KG 检索（短过程 request-response，无进度事件）
   */
  async retrievalSearch(params: KGRetrievalParams): Promise<KGRetrievalResult> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    return this.sendRequest<KGRetrievalResult>(
      requestId,
      {
        type: 'kg:retrieval-search',
        requestId,
        data: params
      },
      120_000
    ) // 2 分钟超时（涉及多次 API 调用）
  }

  /**
   * 查询嵌入状态
   */
  async queryEmbeddingStatus(): Promise<KGEmbeddingProgressData> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    return this.sendRequest<KGEmbeddingProgressData>(requestId, {
      type: 'kg:query-embedding-status',
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

  onBuildProgress(
    listener: (
      taskId: string,
      completed: number,
      failed: number,
      total: number,
      entitiesTotal: number,
      relationsTotal: number
    ) => void
  ): () => void {
    this.buildProgressListeners.add(listener)
    return () => this.buildProgressListeners.delete(listener)
  }

  onBuildCompleted(
    listener: (
      taskId: string,
      targetNamespace?: string,
      targetDatabase?: string,
      graphTableBase?: string,
      embeddingConfigId?: string
    ) => void
  ): () => void {
    this.buildCompletedListeners.add(listener)
    return () => this.buildCompletedListeners.delete(listener)
  }

  onBuildFailed(listener: (taskId: string, error: string) => void): () => void {
    this.buildFailedListeners.add(listener)
    return () => this.buildFailedListeners.delete(listener)
  }

  // 图谱数据查询事件监听器
  onGraphDataBatch(listener: (data: GraphDataBatchEvent) => void): () => void {
    this.graphDataBatchListeners.add(listener)
    return () => this.graphDataBatchListeners.delete(listener)
  }

  onGraphDataComplete(listener: (sessionId: string) => void): () => void {
    this.graphDataCompleteListeners.add(listener)
    return () => this.graphDataCompleteListeners.delete(listener)
  }

  onGraphDataError(listener: (sessionId: string, error: string) => void): () => void {
    this.graphDataErrorListeners.add(listener)
    return () => this.graphDataErrorListeners.delete(listener)
  }

  onGraphDataCancelled(listener: (sessionId: string) => void): () => void {
    this.graphDataCancelledListeners.add(listener)
    return () => this.graphDataCancelledListeners.delete(listener)
  }

  onEmbeddingProgress(listener: (data: KGEmbeddingProgressData) => void): () => void {
    this.embeddingProgressListeners.add(listener)
    return () => this.embeddingProgressListeners.delete(listener)
  }

  onEmbeddingRecoveryNeeded(listener: (items: KGEmbeddingRecoveryItem[]) => void): () => void {
    this.embeddingRecoveryListeners.add(listener)
    return () => this.embeddingRecoveryListeners.delete(listener)
  }

  // ==========================================================================
  // 消息处理
  // ==========================================================================

  private handleMessage(msg: KGToMainMessage): void {
    switch (msg.type) {
      case 'kg:ready':
        this.isReady = true
        this.readyResolve?.()
        if (this.pendingProviders) {
          this.sendToProcess({
            type: 'kg:update-model-providers',
            providers: this.pendingProviders
          })
        }
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

      case 'kg:schema-created': {
        const pending = this.pendingRequests.get(msg.requestId)
        if (pending) {
          clearTimeout(pending.timeoutId)
          this.pendingRequests.delete(msg.requestId)
          pending.resolve(msg.tables)
        }
        break
      }

      case 'kg:schema-error': {
        const pending = this.pendingRequests.get(msg.requestId)
        if (pending) {
          clearTimeout(pending.timeoutId)
          this.pendingRequests.delete(msg.requestId)
          pending.reject(new Error(msg.error))
        }
        break
      }

      case 'kg:build-progress':
        for (const listener of this.buildProgressListeners) {
          listener(
            msg.taskId,
            msg.completed,
            msg.failed,
            msg.total,
            msg.entitiesTotal,
            msg.relationsTotal
          )
        }
        break

      case 'kg:build-completed':
        for (const listener of this.buildCompletedListeners) {
          listener(
            msg.taskId,
            msg.targetNamespace,
            msg.targetDatabase,
            msg.graphTableBase,
            msg.embeddingConfigId
          )
        }
        break

      case 'kg:build-failed':
        for (const listener of this.buildFailedListeners) {
          listener(msg.taskId, msg.error)
        }
        break

      case 'kg:build-status': {
        const pending = this.pendingRequests.get(msg.requestId)
        if (pending) {
          clearTimeout(pending.timeoutId)
          this.pendingRequests.delete(msg.requestId)
          pending.resolve(msg.tasks)
        }
        break
      }

      // 图谱数据查询响应
      case 'kg:graph-query-started': {
        const pending = this.pendingRequests.get(msg.requestId)
        if (pending) {
          clearTimeout(pending.timeoutId)
          this.pendingRequests.delete(msg.requestId)
          pending.resolve(msg.sessionId)
        }
        break
      }

      case 'kg:graph-data-batch':
        for (const listener of this.graphDataBatchListeners) {
          listener({
            sessionId: msg.sessionId,
            entities: msg.entities,
            relations: msg.relations,
            progress: msg.progress
          })
        }
        break

      case 'kg:graph-data-complete':
        for (const listener of this.graphDataCompleteListeners) {
          listener(msg.sessionId)
        }
        break

      case 'kg:graph-data-error':
        // 检查是否是 pending request 的错误（参数校验失败等）
        for (const [requestId, pending] of this.pendingRequests) {
          if (requestId === msg.sessionId) {
            clearTimeout(pending.timeoutId)
            this.pendingRequests.delete(requestId)
            pending.reject(new Error(msg.error))
            return
          }
        }
        // 否则是查询过程中的错误
        for (const listener of this.graphDataErrorListeners) {
          listener(msg.sessionId, msg.error)
        }
        break

      case 'kg:graph-data-cancelled':
        for (const listener of this.graphDataCancelledListeners) {
          listener(msg.sessionId)
        }
        break

      // 嵌入相关消息
      case 'kg:embedding-progress':
        for (const listener of this.embeddingProgressListeners) {
          listener(msg.data)
        }
        break

      case 'kg:embedding-status': {
        const pending = this.pendingRequests.get(msg.requestId)
        if (pending) {
          clearTimeout(pending.timeoutId)
          this.pendingRequests.delete(msg.requestId)
          pending.resolve(msg.data)
        }
        break
      }

      case 'kg:embedding-recovery-needed':
        for (const listener of this.embeddingRecoveryListeners) {
          listener(msg.items)
        }
        break

      // KG 检索响应
      case 'kg:retrieval-result': {
        const pending = this.pendingRequests.get(msg.requestId)
        if (pending) {
          clearTimeout(pending.timeoutId)
          this.pendingRequests.delete(msg.requestId)
          pending.resolve(msg.data)
        }
        break
      }

      case 'kg:retrieval-error': {
        const pending = this.pendingRequests.get(msg.requestId)
        if (pending) {
          clearTimeout(pending.timeoutId)
          this.pendingRequests.delete(msg.requestId)
          pending.reject(new Error(msg.error))
        }
        break
      }

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

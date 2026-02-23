/**
 * @file 向量索引器通信桥
 * @description Main 进程与 Utility Process (VectorIndexer) 之间的通信桥
 */

import { utilityProcess } from 'electron'
import type { UtilityProcess } from 'electron'
import path from 'path'
import type {
  MainToIndexerMessage,
  IndexerToMainMessage,
  IndexerConfig,
  IndexerDBConfig,
  IndexerStats,
  StagingStatus
} from '@shared/vector-indexer-ipc.types'
import type { QueryService } from '../surrealdb-service'
import { logger } from '../logger'
import { KnowledgeLibraryService } from '../knowledgeBase-library/knowledge-library-service'
import { KnowledgeConfigService } from '../knowledgeBase-library/knowledge-config-service'
import { DocumentService } from '../knowledgeBase-library/document-service'

// ============================================================================
// 类型定义
// ============================================================================

interface PendingRequest<T> {
  resolve: (value: T) => void
  reject: (error: Error) => void
  timeoutId: NodeJS.Timeout
}

interface BatchCompletedEvent {
  tableName: string
  count: number
  duration: number
}

interface ProgressEvent {
  transferred: number
  pending: number
  activeTableCount: number
}

interface ErrorEvent {
  message: string
  details?: string
}

// ============================================================================
// VectorIndexerBridge
// ============================================================================

export class VectorIndexerBridge {
  private process: UtilityProcess | null = null
  private pendingRequests: Map<string, PendingRequest<any>> = new Map()
  private isReady = false
  private isRunning = false
  private readyPromise: Promise<void> | null = null
  private readyResolve: (() => void) | null = null

  /** 依赖注入 */
  private queryService?: QueryService
  private knowledgeLibraryService?: KnowledgeLibraryService
  private knowledgeConfigService = new KnowledgeConfigService()
  private documentService = new DocumentService()

  /** 事件监听器 */
  private batchCompletedListeners: Set<(event: BatchCompletedEvent) => void> = new Set()
  private progressListeners: Set<(event: ProgressEvent) => void> = new Set()
  private errorListeners: Set<(event: ErrorEvent) => void> = new Set()
  private startedListeners: Set<() => void> = new Set()
  private stoppedListeners: Set<() => void> = new Set()

  // ==========================================================================
  // 生命周期
  // ==========================================================================

  /**
   * 启动 utility process（仅创建进程，不启动索引循环）
   */
  async spawn(): Promise<void> {
    if (this.process) {
      logger.info('[VectorIndexerBridge] Process already spawned')
      return
    }

    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve
    })

    const modulePath = path.join(__dirname, 'utility/vector-indexer.js')
    logger.info('[VectorIndexerBridge] Spawning utility process:', modulePath)

    this.process = utilityProcess.fork(modulePath)

    this.process.on('message', (msg: IndexerToMainMessage) => {
      this.handleMessage(msg)
    })

    this.process.on('exit', (code) => {
      logger.info('[VectorIndexerBridge] Process exited with code:', code)
      this.process = null
      this.isReady = false
      this.isRunning = false
    })

    await this.readyPromise
    logger.info('[VectorIndexerBridge] Process ready')
  }

  /**
   * 关闭 utility process
   */
  kill(): void {
    if (this.process) {
      this.process.kill()
      this.process = null
      this.isReady = false
      this.isRunning = false
    }
  }

  // ==========================================================================
  // 依赖注入
  // ==========================================================================

  setQueryService(queryService: QueryService): void {
    this.queryService = queryService
  }

  setKnowledgeLibraryService(service: KnowledgeLibraryService): void {
    this.knowledgeLibraryService = service
  }

  // ==========================================================================
  // 索引器控制 API
  // ==========================================================================

  /**
   * 启动索引循环
   * @param config 可选配置覆盖
   */
  async startIndexer(config?: Partial<IndexerConfig>): Promise<void> {
    if (!this.process || !this.isReady) {
      throw new Error('VectorIndexer process not ready')
    }

    if (this.isRunning) {
      logger.info('[VectorIndexerBridge] Indexer already running')
      return
    }

    // 从 queryService 获取数据库连接信息
    const dbConfig = this.getDBConfig()
    if (!dbConfig) {
      throw new Error('Database connection not available')
    }

    this.send({
      type: 'indexer:start',
      dbConfig,
      config
    })
  }

  /**
   * 停止索引循环
   */
  stopIndexer(): void {
    if (!this.process) return

    this.send({ type: 'indexer:stop' })
  }

  /**
   * 更新配置（运行时）
   */
  updateConfig(config: Partial<IndexerConfig>): void {
    if (!this.process) return

    this.send({
      type: 'indexer:config',
      config
    })
  }

  /**
   * 查询统计信息
   */
  async getStats(): Promise<IndexerStats | null> {
    if (!this.process || !this.isReady) return null

    const requestId = this.generateRequestId()
    return this.sendWithResponse<IndexerStats>({
      type: 'indexer:query-stats',
      requestId
    })
  }

  /**
   * 查询暂存表状态
   * @returns 暂存表状态信息，包含 active/idle 状态和处理进度
   */
  async getStagingStatus(): Promise<StagingStatus | null> {
    if (!this.process || !this.isReady) return null

    const requestId = this.generateRequestId()
    return this.sendWithResponse<StagingStatus>({
      type: 'indexer:query-staging-status',
      requestId
    })
  }

  /**
   * 检查是否正在运行
   */
  getIsRunning(): boolean {
    return this.isRunning
  }

  /**
   * 检查进程是否就绪
   */
  getIsReady(): boolean {
    return this.isReady
  }

  // ==========================================================================
  // 事件监听
  // ==========================================================================

  onBatchCompleted(listener: (event: BatchCompletedEvent) => void): () => void {
    this.batchCompletedListeners.add(listener)
    return () => {
      this.batchCompletedListeners.delete(listener)
    }
  }

  onProgress(listener: (event: ProgressEvent) => void): () => void {
    this.progressListeners.add(listener)
    return () => {
      this.progressListeners.delete(listener)
    }
  }

  onError(listener: (event: ErrorEvent) => void): () => void {
    this.errorListeners.add(listener)
    return () => {
      this.errorListeners.delete(listener)
    }
  }

  onStarted(listener: () => void): () => void {
    this.startedListeners.add(listener)
    return () => {
      this.startedListeners.delete(listener)
    }
  }

  onStopped(listener: () => void): () => void {
    this.stoppedListeners.add(listener)
    return () => {
      this.stoppedListeners.delete(listener)
    }
  }

  // ==========================================================================
  // 消息处理
  // ==========================================================================

  private handleMessage(msg: IndexerToMainMessage): void {
    switch (msg.type) {
      case 'indexer:ready':
        this.isReady = true
        this.readyResolve?.()
        break

      case 'indexer:started':
        this.isRunning = true
        logger.info('[VectorIndexerBridge] Indexer started')
        for (const listener of this.startedListeners) {
          try {
            listener()
          } catch (err) {
            logger.error('[VectorIndexerBridge] Started listener error:', err)
          }
        }
        break

      case 'indexer:stopped':
        this.isRunning = false
        logger.info('[VectorIndexerBridge] Indexer stopped')
        for (const listener of this.stoppedListeners) {
          try {
            listener()
          } catch (err) {
            logger.error('[VectorIndexerBridge] Stopped listener error:', err)
          }
        }
        break

      case 'indexer:batch-completed':
        for (const listener of this.batchCompletedListeners) {
          try {
            listener({
              tableName: msg.tableName,
              count: msg.count,
              duration: msg.duration
            })
          } catch (err) {
            logger.error('[VectorIndexerBridge] BatchCompleted listener error:', err)
          }
        }
        break

      case 'indexer:progress':
        for (const listener of this.progressListeners) {
          try {
            listener({
              transferred: msg.transferred,
              pending: msg.pending,
              activeTableCount: msg.activeTableCount
            })
          } catch (err) {
            logger.error('[VectorIndexerBridge] Progress listener error:', err)
          }
        }
        break

      case 'indexer:error':
        logger.error('[VectorIndexerBridge] Error from indexer:', msg.message, msg.details)
        for (const listener of this.errorListeners) {
          try {
            listener({
              message: msg.message,
              details: msg.details
            })
          } catch (err) {
            logger.error('[VectorIndexerBridge] Error listener error:', err)
          }
        }
        break

      case 'indexer:stats': {
        const pending = this.pendingRequests.get(msg.requestId)
        if (pending) {
          clearTimeout(pending.timeoutId)
          this.pendingRequests.delete(msg.requestId)
          pending.resolve(msg.stats)
        }
        break
      }

      case 'indexer:staging-status': {
        const pending = this.pendingRequests.get(msg.requestId)
        if (pending) {
          clearTimeout(pending.timeoutId)
          this.pendingRequests.delete(msg.requestId)
          pending.resolve(msg.status)
        }
        break
      }

      case 'indexer:document-embedded': {
        // 🎯 更新 kb_document_embedding 的嵌入信息
        this.updateKbDocumentEmbeddingStatus(msg).catch((err) => {
          const details = err instanceof Error ? err.stack || err.message : String(err)
          logger.error('[VectorIndexerBridge] Failed to update kb_document_embedding', {
            error: err instanceof Error ? err.message : String(err)
          })

          // 对外抛出可见错误（避免“数据库操作失败但不报错”）
          for (const listener of this.errorListeners) {
            try {
              listener({
                message: 'Failed to update kb_document_embedding',
                details
              })
            } catch (e) {
              logger.error('[VectorIndexerBridge] Error listener error:', e)
            }
          }

          // 关键写入失败：停止索引器，避免继续产生不一致数据
          try {
            this.stopIndexer()
          } catch (stopErr) {
            logger.error('[VectorIndexerBridge] Failed to stop indexer after db update failure', {
              error: stopErr instanceof Error ? stopErr.message : String(stopErr)
            })
          }
        })
        break
      }
    }
  }

  private send(msg: MainToIndexerMessage): void {
    if (!this.process) {
      throw new Error('VectorIndexer process not started')
    }
    this.process.postMessage(msg)
  }

  private sendWithResponse<T>(msg: MainToIndexerMessage & { requestId: string }): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(msg.requestId)) {
          this.pendingRequests.delete(msg.requestId)
          reject(new Error('Request timeout'))
        }
      }, 30000) // 30 秒超时

      this.pendingRequests.set(msg.requestId, { resolve, reject, timeoutId })
      this.send(msg)
    })
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  /** 数据库连接配置（启动时设置） */
  private dbConnectionConfig?: {
    serverUrl: string
    username: string
    password: string
    namespace: string
  }

  /**
   * 设置数据库连接配置（供外部传入）
   */
  setDBConnectionConfig(config: {
    serverUrl: string
    username: string
    password: string
    namespace: string
  }): void {
    this.dbConnectionConfig = config
  }

  private getDBConfig(): IndexerDBConfig | null {
    if (!this.queryService || !this.queryService.isConnected()) {
      return null
    }

    // 优先使用外部设置的配置
    if (this.dbConnectionConfig) {
      return {
        serverUrl: this.dbConnectionConfig.serverUrl,
        username: this.dbConnectionConfig.username,
        password: this.dbConnectionConfig.password,
        namespace: this.dbConnectionConfig.namespace,
        database: 'system' // 暂存表所在的数据库
      }
    }

    // 使用默认配置（需要根据实际情况调整）
    const namespace = this.queryService.getNamespace() || 'knowledge'
    logger.warn('[VectorIndexerBridge] Using fallback DB config')
    return {
      serverUrl: 'ws://127.0.0.1:8000',
      username: 'root',
      password: 'root',
      namespace,
      database: 'system'
    }
  }
  // ==========================================================================
  // 更新嵌入状态到 kb_document_embedding 关联表
  // ==========================================================================

  /**
   * 更新文档嵌入状态到 kb_document_embedding 关联表
   * 支持同一文档对应多个嵌入配置（一对多）
   * 当文档的向量数据被成功搬运到目标表后调用
   */
  private async updateKbDocumentEmbeddingStatus(params: {
    targetNamespace: string
    targetDatabase: string
    documentId: string
    fileKey: string
    runId?: string
    embeddingConfigId: string
    dimensions: number
    chunkCount: number
  }): Promise<void> {
    if (!this.queryService || !this.queryService.isConnected()) {
      throw new Error('QueryService not available for embedding status update')
    }
    const embeddingConfigName = await this.resolveEmbeddingConfigName(
      params.targetDatabase,
      params.embeddingConfigId
    )

    // 构造目标向量表名（与 transfer-worker 一致）
    const safeId = String(params.embeddingConfigId).replace(/[^a-zA-Z0-9_]/g, '_')
    const vectorTableName = `emb_cfg_${safeId}_${params.dimensions}_chunks`

    const hasRunId = typeof params.runId === 'string' && params.runId.length > 0

    // ✅ 直接查询目标向量表中该文档的实际 chunk 数量（严格模式：失败即报错）
    //    run_id 存在时按 run 过滤，避免历史 run 残留影响当前计数
    const countSql = hasRunId
      ? `SELECT count() AS count FROM \`${vectorTableName}\` WHERE file_key = $fileKey AND run_id = $runId GROUP ALL;`
      : `SELECT count() AS count FROM \`${vectorTableName}\` WHERE file_key = $fileKey GROUP ALL;`
    const countResult = await this.queryService.queryInDatabase(
      params.targetNamespace,
      params.targetDatabase,
      countSql,
      hasRunId ? { fileKey: params.fileKey, runId: params.runId } : { fileKey: params.fileKey }
    )

    const extractRecords = (result: any): any[] => {
      if (!result) return []
      if (Array.isArray(result)) {
        // [[{...}]]
        if (result.length === 1 && Array.isArray(result[0])) {
          const inner = result[0]
          if (inner.length > 0 && typeof inner[0] === 'object' && !Array.isArray(inner[0])) {
            return inner
          }
        }
        // [{ result: [...] }]
        for (const entry of result) {
          if (Array.isArray((entry as any)?.result)) {
            return (entry as any).result
          }
        }
        // [{...}]
        if (result.length > 0 && typeof result[0] === 'object' && !(result[0] as any).result) {
          return result
        }
        return []
      }
      if (Array.isArray((result as any)?.result)) return (result as any).result
      return []
    }

    const countRecords = extractRecords(countResult)
    const countedRaw = countRecords[0]?.count
    const actualChunkCount = Number(countedRaw)

    if (!Number.isFinite(actualChunkCount) || actualChunkCount < 0) {
      throw new Error(
        `COUNT query returned invalid count for ${vectorTableName} fileKey=${params.fileKey}: ${String(countedRaw)}`
      )
    }

    // UPSERT 到 kb_document_embedding 关联表
    // 唯一索引: (file_key, embedding_config_id, dimensions)
    const sql = `
      UPSERT kb_document_embedding SET
        file_key = $fileKey,
        embedding_config_id = $embeddingConfigId,
        embedding_config_name = $embeddingConfigName,
        dimensions = $dimensions,
        status = 'completed',
        chunk_count = $chunkCount,
        task_id = $taskId,
        updated_at = time::now()
      WHERE file_key = $fileKey
        AND embedding_config_id = $embeddingConfigId
        AND dimensions = $dimensions;
    `

    await this.queryService.queryInDatabase(params.targetNamespace, params.targetDatabase, sql, {
      fileKey: params.fileKey,
      embeddingConfigId: params.embeddingConfigId,
      embeddingConfigName: embeddingConfigName ?? null,
      dimensions: params.dimensions,
      chunkCount: actualChunkCount,
      taskId: hasRunId ? params.runId : null
    })

    logger.info('[VectorIndexerBridge] Updated kb_document_embedding status', {
      fileKey: params.fileKey,
      runId: hasRunId ? params.runId : null,
      embeddingConfigId: params.embeddingConfigId,
      embeddingConfigName,
      dimensions: params.dimensions,
      chunkCount: actualChunkCount
    })
  }

  private async resolveEmbeddingConfigName(
    targetDatabase: string,
    embeddingConfigId: string
  ): Promise<string | null> {
    if (!this.knowledgeLibraryService) return null

    try {
      const knowledgeBases = await this.knowledgeLibraryService.getAll()
      const kb = knowledgeBases.find((item) => item.databaseName === targetDatabase)
      if (!kb?.documentPath) return null

      const kbRoot = this.documentService.getFullDirectoryPath(kb.documentPath)
      const config = await this.knowledgeConfigService.readConfig(kbRoot)
      const name = config.global.embedding?.configs?.find((c) => c.id === embeddingConfigId)?.name
      return name ?? null
    } catch (error) {
      logger.warn('[VectorIndexerBridge] Failed to resolve embedding config name', {
        targetDatabase,
        embeddingConfigId,
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  }
}

// 单例导出
export const vectorIndexerBridge = new VectorIndexerBridge()

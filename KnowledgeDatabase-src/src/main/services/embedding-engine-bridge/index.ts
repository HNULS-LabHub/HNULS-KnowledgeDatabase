/**
 * @file 嵌入引擎通信桥
 * @description Main 进程与 Utility Process (EmbeddingEngine) 之间的通信桥
 */

import { utilityProcess, UtilityProcess, BrowserWindow } from 'electron'
import path from 'path'
import type {
  SubmitEmbeddingTaskParams,
  EmbeddingTaskResult,
  EmbeddingTaskInfo,
  EmbeddingChannelInfo
} from '../../../preload/types/embedding.types'
import type {
  MainToEngineMessage,
  EngineToMainMessage
} from '../../../utility/embedding-engine/ipc-protocol'
import type { ChannelConfig } from '../../../utility/embedding-engine/types'
import { globalMonitorBridge } from '../global-monitor-bridge'
import { ChunkMetaStore } from '../chunking/chunk-meta-store'
import { DocumentService } from '../knowledgeBase-library/document-service'
import { KnowledgeLibraryService } from '../knowledgeBase-library/knowledge-library-service'
import type { QueryService } from '../surrealdb-service'
import { logger } from '../logger'

// ============================================================================
// 类型定义
// ============================================================================

interface PendingRequest<T> {
  resolve: (value: T) => void
  reject: (error: Error) => void
}

// ============================================================================
// EmbeddingEngineBridge
// ============================================================================

export class EmbeddingEngineBridge {
  private process: UtilityProcess | null = null
  private pendingRequests: Map<string, PendingRequest<any>> = new Map()
  private isReady = false
  private readyPromise: Promise<void> | null = null
  private readyResolve: (() => void) | null = null

  /** 任务 ID -> 文档 ID 映射 */
  private taskToDocumentMap: Map<string, string> = new Map()
  /** 文档 ID -> 提交参数 */
  private taskParamsByDocument: Map<string, SubmitEmbeddingTaskParams> = new Map()

  /** 依赖注入 */
  private queryService?: QueryService
  private knowledgeLibraryService?: KnowledgeLibraryService
  private documentService?: DocumentService
  private chunkMetaStore: ChunkMetaStore = new ChunkMetaStore()

  /** 数据库同步队列 */
  private syncQueue: Promise<void> = Promise.resolve()

  /** 完成事件监听器 */
  private completedListeners: Set<(result: EmbeddingTaskResult) => void> = new Set()
  /** 失败事件监听器 */
  private failedListeners: Set<(error: { documentId: string; error: string }) => void> = new Set()

  // ==========================================================================
  // 生命周期
  // ==========================================================================

  async start(): Promise<void> {
    if (this.process) {
      console.log('[EmbeddingEngineBridge] Already started')
      return
    }

    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve
    })

    const modulePath = path.join(__dirname, 'utility/embedding.js')
    console.log('[EmbeddingEngineBridge] Starting utility process:', modulePath)

    this.process = utilityProcess.fork(modulePath)

    this.process.on('message', (msg: EngineToMainMessage) => {
      this.handleMessage(msg)
    })

    this.process.on('exit', (code) => {
      console.log('[EmbeddingEngineBridge] Process exited with code:', code)
      this.process = null
      this.isReady = false
    })

    await this.readyPromise
    console.log('[EmbeddingEngineBridge] Ready')
  }

  stop(): void {
    if (this.process) {
      this.process.kill()
      this.process = null
      this.isReady = false
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

  setDocumentService(service: DocumentService): void {
    this.documentService = service
  }

  // ==========================================================================
  // 消息处理
  // ==========================================================================

  private handleMessage(msg: EngineToMainMessage): void {
    switch (msg.type) {
      case 'ready':
        this.isReady = true
        this.readyResolve?.()
        break

      case 'task:started': {
        const pending = this.pendingRequests.get(msg.requestId)
        if (pending) {
          this.pendingRequests.delete(msg.requestId)
          this.taskToDocumentMap.set(msg.taskId, msg.documentId)
          pending.resolve(msg.taskId)
        }
        break
      }

      case 'task:progress': {
        // 转发进度到 GlobalMonitor
        globalMonitorBridge.updateProgress(msg.taskId, msg.progress, {
          documentId: msg.documentId,
          completedChunks: msg.completedChunks,
          totalChunks: msg.totalChunks,
          currentRPM: msg.currentRPM
        })

        // 广播进度到所有窗口
        this.broadcastToRenderers('embedding:progress', {
          documentId: msg.documentId,
          taskId: msg.taskId,
          progress: msg.progress,
          completedChunks: msg.completedChunks,
          totalChunks: msg.totalChunks,
          currentRPM: msg.currentRPM
        })
        break
      }

      case 'task:completed': {
        // 通知 GlobalMonitor 完成
        globalMonitorBridge.complete(msg.taskId)

        // 通知监听器
        const result: EmbeddingTaskResult = {
          documentId: msg.documentId,
          embeddings: msg.embeddings,
          completedAt: Date.now()
        }
        for (const listener of this.completedListeners) {
          try {
            listener(result)
          } catch (err) {
            console.error('[EmbeddingEngineBridge] Completed listener error:', err)
          }
        }
        // 同步向量到 SurrealDB（异步队列，不阻塞主流程）
        const params = this.taskParamsByDocument.get(result.documentId)
        this.taskParamsByDocument.delete(result.documentId)
        this.enqueueSync(result, params)

        // 广播到渲染进程
        this.broadcastToRenderers('embedding:completed', result)
        break
      }

      case 'task:failed': {
        // 通知 GlobalMonitor 失败
        globalMonitorBridge.fail(msg.taskId, msg.error)

        // 通知监听器
        const error = { documentId: msg.documentId, error: msg.error }
        for (const listener of this.failedListeners) {
          try {
            listener(error)
          } catch (err) {
            console.error('[EmbeddingEngineBridge] Failed listener error:', err)
          }
        }
        this.taskParamsByDocument.delete(msg.documentId)

        // 广播到渲染进程
        this.broadcastToRenderers('embedding:failed', error)
        break
      }

      case 'task:paused':
      case 'task:resumed':
      case 'task:cancelled': {
        // 通知 GlobalMonitor 状态变更
        if (msg.type === 'task:paused') {
          globalMonitorBridge.pause(msg.taskId)
        } else if (msg.type === 'task:resumed') {
          globalMonitorBridge.resume(msg.taskId)
        }
        break
      }

      case 'query:task-info:result': {
        const pending = this.pendingRequests.get(msg.requestId)
        if (pending) {
          this.pendingRequests.delete(msg.requestId)
          pending.resolve(msg.data)
        }
        break
      }

      case 'query:channels:result': {
        const pending = this.pendingRequests.get(msg.requestId)
        if (pending) {
          this.pendingRequests.delete(msg.requestId)
          pending.resolve(msg.channels)
        }
        break
      }

      case 'error': {
        if (msg.requestId) {
          const pending = this.pendingRequests.get(msg.requestId)
          if (pending) {
            this.pendingRequests.delete(msg.requestId)
            pending.reject(new Error(msg.message))
          }
        }
        console.error('[EmbeddingEngineBridge] Error:', msg.message)
        break
      }
    }
  }

  private send(msg: MainToEngineMessage): void {
    if (!this.process) {
      throw new Error('EmbeddingEngine process not started')
    }
    this.process.postMessage(msg)
  }

  private sendWithResponse<T>(msg: MainToEngineMessage & { requestId: string }): Promise<T> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(msg.requestId, { resolve, reject })
      this.send(msg)

      // 超时处理
      setTimeout(() => {
        if (this.pendingRequests.has(msg.requestId)) {
          this.pendingRequests.delete(msg.requestId)
          reject(new Error('Request timeout'))
        }
      }, 60000) // 60 秒超时
    })
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  private broadcastToRenderers(channel: string, data: unknown): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    }
  }

  // ==========================================================================
  // 任务操作 API
  // ==========================================================================

  async submitTask(params: SubmitEmbeddingTaskParams): Promise<string> {
    // 1. 先在 GlobalMonitor 创建任务
    const taskId = await globalMonitorBridge.createTask({
      type: 'embedding',
      title: `嵌入: ${params.meta?.fileName || params.documentId}`,
      meta: {
        documentId: params.documentId,
        totalChunks: params.chunks.length
      }
    })
    this.taskParamsByDocument.set(params.documentId, params)

    // 2. 发送给嵌入引擎
    const requestId = this.generateRequestId()
    return this.sendWithResponse<string>({
      type: 'embed:start',
      requestId,
      data: {
        ...params,
        taskId
      }
    })
  }

  pauseTask(documentId: string): void {
    this.send({ type: 'embed:pause', documentId })
  }

  resumeTask(documentId: string): void {
    this.send({ type: 'embed:resume', documentId })
  }

  cancelTask(documentId: string): void {
    this.send({ type: 'embed:cancel', documentId })
  }

  async getTaskInfo(documentId: string): Promise<EmbeddingTaskInfo | null> {
    const requestId = this.generateRequestId()
    return this.sendWithResponse<EmbeddingTaskInfo | null>({
      type: 'query:task-info',
      requestId,
      documentId
    })
  }

  setConcurrency(concurrency: number): void {
    this.send({ type: 'config:set-concurrency', concurrency })
  }

  updateChannels(channels: ChannelConfig[]): void {
    this.send({ type: 'config:update-channels', channels })
  }

  async getChannels(): Promise<EmbeddingChannelInfo[]> {
    const requestId = this.generateRequestId()
    return this.sendWithResponse<EmbeddingChannelInfo[]>({
      type: 'query:channels',
      requestId
    })
  }

  // ==========================================================================
  // 向量检索
  // ==========================================================================

  async search(params: {
    knowledgeBaseId: number
    queryVector: number[]
    k?: number
  }): Promise<
    Array<{
      id: string
      content: string
      chunk_index?: number
      file_key?: string
      file_name?: string
      distance?: number
    }>
  > {
    if (!this.queryService || !this.queryService.isConnected()) {
      console.warn('[EmbeddingEngineBridge] QueryService not available, skip search')
      return []
    }

    const kbService = this.getKnowledgeLibraryService()
    const kb = await kbService.getById(params.knowledgeBaseId)
    if (!kb?.databaseName) {
      console.warn('[EmbeddingEngineBridge] Knowledge base not found for search', params.knowledgeBaseId)
      return []
    }

    const namespace = this.queryService.getNamespace() || 'knowledge'
    const rawResult = await this.queryService.vectorSearch(
      namespace,
      kb.databaseName,
      params.queryVector,
      params.k ?? 10
    )

    return this.extractQueryRecords(rawResult) as Array<{
      id: string
      content: string
      chunk_index?: number
      file_key?: string
      file_name?: string
      distance?: number
    }>
  }

  // ==========================================================================
  // 事件监听
  // ==========================================================================

  onCompleted(listener: (result: EmbeddingTaskResult) => void): () => void {
    this.completedListeners.add(listener)
    return () => {
      this.completedListeners.delete(listener)
    }
  }

  onFailed(listener: (error: { documentId: string; error: string }) => void): () => void {
    this.failedListeners.add(listener)
    return () => {
      this.failedListeners.delete(listener)
    }
  }

  // ==========================================================================
  // 内部：依赖获取
  // ==========================================================================

  private getKnowledgeLibraryService(): KnowledgeLibraryService {
    if (!this.knowledgeLibraryService) {
      this.knowledgeLibraryService = new KnowledgeLibraryService()
    }
    return this.knowledgeLibraryService
  }

  private getDocumentService(): DocumentService {
    if (!this.documentService) {
      this.documentService = new DocumentService()
    }
    return this.documentService
  }

  // ==========================================================================
  // 内部：向量同步
  // ==========================================================================

  private enqueueSync(result: EmbeddingTaskResult, params?: SubmitEmbeddingTaskParams): void {
    this.syncQueue = this.syncQueue
      .then(() => this.syncEmbeddingResult(result, params))
      .catch((err) => {
        console.error('[EmbeddingEngineBridge] Failed to sync embeddings:', err)
      })
  }

  private async syncEmbeddingResult(
    result: EmbeddingTaskResult,
    params?: SubmitEmbeddingTaskParams
  ): Promise<void> {
    if (!this.queryService || !this.queryService.isConnected()) {
      console.warn('[EmbeddingEngineBridge] QueryService not available, skip sync')
      return
    }

    const knowledgeBaseIdRaw = params?.meta?.knowledgeBaseId
    const knowledgeBaseId = knowledgeBaseIdRaw ? Number(knowledgeBaseIdRaw) : NaN
    if (!knowledgeBaseId || Number.isNaN(knowledgeBaseId)) {
      console.warn('[EmbeddingEngineBridge] Missing knowledgeBaseId, skip sync', knowledgeBaseIdRaw)
      return
    }

    const kbService = this.getKnowledgeLibraryService()
    const kb = await kbService.getById(knowledgeBaseId)
    if (!kb?.databaseName || !kb.documentPath) {
      console.warn('[EmbeddingEngineBridge] Knowledge base not found or invalid', knowledgeBaseId)
      return
    }

    const documentService = this.getDocumentService()
    const kbRoot = documentService.getFullDirectoryPath(kb.documentPath)

    const fallbackFileKey = params?.documentId || result.documentId
    const fallbackFileName = params?.meta?.fileName || path.basename(fallbackFileKey)

    const chunkingResult = await this.loadChunkingResult(kbRoot, fallbackFileName)
    const fileKey = chunkingResult?.fileKey || fallbackFileKey
    const fileName = chunkingResult ? path.basename(chunkingResult.fileKey) : fallbackFileName
    const filePath = fileKey
    const fileType = path.extname(fileName).slice(1)

    const chunks = chunkingResult?.chunks?.length
      ? chunkingResult.chunks
      : this.fallbackChunksFromParams(params)

    if (!chunks || chunks.length === 0) {
      console.warn('[EmbeddingEngineBridge] No chunks found for sync', { fileKey })
      return
    }

    const embeddingsMap = new Map<number, number[]>(
      result.embeddings.map((item) => [item.index, item.embedding])
    )

    const chunkRecords = chunks.map((chunk) => ({
      chunk_index: chunk.index,
      content: chunk.content,
      char_count: chunk.size ?? chunk.content.length,
      start_char: chunk.startChar ?? null,
      end_char: chunk.endChar ?? null,
      embedding: embeddingsMap.get(chunk.index) ?? null
    }))

    const embeddingDimensions =
      result.embeddings[0]?.embedding?.length ?? params?.embeddingConfig?.dimensions ?? null

    const namespace = this.queryService.getNamespace() || 'knowledge'

    const docRecord = await this.upsertKbDocument({
      namespace,
      database: kb.databaseName,
      fileKey,
      fileName,
      filePath,
      fileType,
      chunkCount: chunkRecords.length,
      embeddingModel: params?.embeddingConfig?.modelId ?? null,
      embeddingDimensions
    })

    if (!docRecord?.id) {
      logger.warn('[EmbeddingEngineBridge] Failed to upsert kb_document - no id returned', { 
        fileKey,
        docRecord 
      })
      return
    }
    
    logger.debug('[EmbeddingEngineBridge] Successfully upserted kb_document', {
      documentId: docRecord.id,
      fileKey
    })

    if (embeddingDimensions) {
      await this.ensureVectorIndex(namespace, kb.databaseName, embeddingDimensions)
    }

    await this.replaceChunks(namespace, kb.databaseName, docRecord.id, chunkRecords)
  }

  private async loadChunkingResult(kbRoot: string, fileName: string) {
    try {
      const meta = await this.chunkMetaStore.loadOrInit({ kbRoot, fileName })
      const activeConfig = meta.activeConfig
      if (!activeConfig) return null
      const key = JSON.stringify(activeConfig)
      return meta.results[key] || null
    } catch (error) {
      console.warn('[EmbeddingEngineBridge] Failed to load chunking result', error)
      return null
    }
  }

  private fallbackChunksFromParams(
    params?: SubmitEmbeddingTaskParams
  ): Array<{
    index: number
    content: string
    size: number
    startChar?: number
    endChar?: number
  }> {
    if (!params?.chunks?.length) return []
    return params.chunks.map((chunk) => ({
      index: chunk.index,
      content: chunk.text,
      size: chunk.text.length
    }))
  }

  private async upsertKbDocument(params: {
    namespace: string
    database: string
    fileKey: string
    fileName: string
    filePath: string
    fileType: string
    chunkCount: number
    embeddingModel: string | null
    embeddingDimensions: number | null
  }): Promise<any | null> {
    if (!this.queryService) return null

    const sql = `
      UPSERT kb_document SET
        file_key = $fileKey,
        file_name = $fileName,
        file_path = $filePath,
        file_type = $fileType,
        chunk_count = $chunkCount,
        embedding_status = 'completed',
        embedding_model = $embeddingModel,
        embedding_dimensions = $embeddingDimensions,
        updated_at = time::now()
      WHERE file_key = $fileKey
      RETURN AFTER;
    `

    const result = await this.queryService.queryInDatabase(
      params.namespace,
      params.database,
      sql,
      {
        fileKey: params.fileKey,
        fileName: params.fileName,
        filePath: params.filePath,
        fileType: params.fileType,
        chunkCount: params.chunkCount,
        embeddingModel: params.embeddingModel,
        embeddingDimensions: params.embeddingDimensions
      }
    )

    logger.debug('[EmbeddingEngineBridge] UPSERT kb_document raw result', { 
      resultType: typeof result,
      isArray: Array.isArray(result),
      result: result 
    })
    
    const records = this.extractQueryRecords(result)
    logger.debug('[EmbeddingEngineBridge] Extracted records', { 
      recordsCount: records.length,
      firstRecord: records[0]
    })
    
    return records[0] || null
  }

  private async replaceChunks(
    namespace: string,
    database: string,
    documentId: string,
    chunkRecords: Array<{
      chunk_index: number
      content: string
      char_count: number
      start_char: number | null
      end_char: number | null
      embedding: number[] | null
    }>
  ): Promise<void> {
    if (!this.queryService) return

    await this.queryService.queryInDatabase(
      namespace,
      database,
      'DELETE chunk WHERE document = $documentId;',
      { documentId }
    )

    const payload = chunkRecords.map((record) => ({
      ...record,
      document: documentId
    }))

    // SurrealDB 的 INSERT 语句会自动处理数组参数
    // 当 $chunks 是数组时，引擎会自动遍历并为每个元素创建记录
    logger.debug('[EmbeddingEngineBridge] Inserting chunks', {
      documentId,
      chunkCount: payload.length
    })
    
    const result = await this.queryService.queryInDatabase(
      namespace, 
      database, 
      'INSERT INTO chunk $chunks;', 
      { chunks: payload }
    )
    
    logger.debug('[EmbeddingEngineBridge] Chunks insert result', { 
      resultType: typeof result,
      isArray: Array.isArray(result),
      result
    })
  }

  private async ensureVectorIndex(
    namespace: string,
    database: string,
    dimensions: number
  ): Promise<void> {
    if (!this.queryService) return

    const sql = `DEFINE INDEX idx_embedding ON chunk FIELDS embedding HNSW DIMENSION ${dimensions} DIST COSINE;`
    try {
      await this.queryService.queryInDatabase(namespace, database, sql)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!message.includes('already exists')) {
        console.warn('[EmbeddingEngineBridge] Failed to ensure vector index', message)
      }
    }
  }

  private extractQueryRecords(result: any): any[] {
    if (!result) return []
    if (Array.isArray(result)) {
      // Handle double-nested arrays from UPSERT RETURN AFTER: [ [ {record} ] ]
      if (result.length === 1 && Array.isArray(result[0])) {
        const inner = result[0]
        if (inner.length > 0 && typeof inner[0] === 'object' && !Array.isArray(inner[0])) {
          return inner
        }
      }
      
      for (const entry of result) {
        if (Array.isArray(entry?.result)) {
          if (entry.result.length > 0) return entry.result
        }
      }
      if (result.length > 0 && typeof result[0] === 'object' && !('result' in result[0])) {
        return result
      }
      return []
    }
    if (Array.isArray(result?.result)) return result.result
    return []
  }
}

// 单例导出
export const embeddingEngineBridge = new EmbeddingEngineBridge()

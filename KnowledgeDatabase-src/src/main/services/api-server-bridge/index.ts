/**
 * @file API Server 通信桥
 * @description Main 进程与 Utility Process (ApiServer) 之间的通信桥
 */

import { utilityProcess } from 'electron'
import type { UtilityProcess } from 'electron'
import path from 'path'
import type {
  MainToApiServerMessage,
  ApiServerToMainMessage,
  ApiServerConfig,
  ApiServerDBConfig,
  ApiServerStatus,
  RetrievalHit,
  RerankModelInfo
} from '@shared/api-server.types'
import { logger } from '../logger'
import type { VectorRetrievalService } from '../vector-retrieval/vector-retrieval-service'
import { ModelConfigService } from '../model-config'
import { knowledgeGraphBridge } from '../knowledge-graph-bridge'
import type { KGRetrievalParams } from '@shared/knowledge-graph-ipc.types'
import type { KGModelsListResult, KGModelInfo } from '@shared/api-server.types'

// ============================================================================
// 类型定义
// ============================================================================

interface PendingRequest<T> {
  resolve: (value: T) => void
  reject: (error: Error) => void
  timeoutId: NodeJS.Timeout
}

// ============================================================================
// ApiServerBridge
// ============================================================================

export class ApiServerBridge {
  private process: UtilityProcess | null = null
  private pendingRequests: Map<string, PendingRequest<unknown>> = new Map()
  private isReady = false
  private isRunning = false
  private readyPromise: Promise<void> | null = null
  private readyResolve: (() => void) | null = null

  /** 向量检索服务（由 main 注入） */
  private vectorRetrievalService: VectorRetrievalService | null = null

  /** 事件监听器 */
  private startedListeners: Set<(port: number, host: string) => void> = new Set()
  private stoppedListeners: Set<() => void> = new Set()
  private errorListeners: Set<(message: string, details?: string) => void> = new Set()

  // ==========================================================================
  // 依赖注入
  // ==========================================================================

  /**
   * 注入向量检索服务（在 main/index.ts 启动 ApiServer 时调用）
   */
  setVectorRetrievalService(service: VectorRetrievalService): void {
    this.vectorRetrievalService = service
    logger.info('[ApiServerBridge] VectorRetrievalService injected')
  }

  // ==========================================================================
  // 生命周期
  // ==========================================================================

  /**
   * 启动 utility process
   */
  async spawn(): Promise<void> {
    if (this.process) {
      logger.info('[ApiServerBridge] Process already spawned')
      return
    }

    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve
    })

    const modulePath = path.join(__dirname, 'utility/api-server.js')
    logger.info('[ApiServerBridge] Spawning utility process:', modulePath)

    this.process = utilityProcess.fork(modulePath)

    this.process.on('message', (msg: ApiServerToMainMessage) => {
      this.handleMessage(msg)
    })

    this.process.on('exit', (code) => {
      logger.info('[ApiServerBridge] Process exited with code:', code)
      this.process = null
      this.isReady = false
      this.isRunning = false
    })

    await this.readyPromise
    logger.info('[ApiServerBridge] Process ready')
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
  // API 服务器控制
  // ==========================================================================

  /**
   * 启动 API 服务器
   */
  async startServer(params: {
    config?: Partial<ApiServerConfig>
    dbConfig: ApiServerDBConfig
    metaFilePath: string
  }): Promise<void> {
    if (!this.process || !this.isReady) {
      throw new Error('ApiServer process not ready')
    }

    if (this.isRunning) {
      logger.info('[ApiServerBridge] Server already running')
      return
    }

    const config: ApiServerConfig = {
      port: params.config?.port ?? 3721,
      host: params.config?.host ?? '0.0.0.0'
    }

    this.send({
      type: 'server:start',
      config,
      dbConfig: params.dbConfig,
      metaFilePath: params.metaFilePath
    })
  }

  /**
   * 停止 API 服务器
   */
  stopServer(): void {
    if (!this.process) return

    this.send({ type: 'server:stop' })
  }

  /**
   * 查询服务器状态
   */
  async getStatus(): Promise<ApiServerStatus | null> {
    if (!this.process || !this.isReady) return null

    const requestId = this.generateRequestId()
    return this.sendWithResponse<ApiServerStatus>({
      type: 'server:query-status',
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

  onStarted(listener: (port: number, host: string) => void): () => void {
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

  onError(listener: (message: string, details?: string) => void): () => void {
    this.errorListeners.add(listener)
    return () => {
      this.errorListeners.delete(listener)
    }
  }

  // ==========================================================================
  // 消息处理
  // ==========================================================================

  private handleMessage(msg: ApiServerToMainMessage): void {
    switch (msg.type) {
      case 'server:ready':
        this.isReady = true
        this.readyResolve?.()
        break

      case 'server:started':
        this.isRunning = true
        logger.info(`[ApiServerBridge] Server started on ${msg.host}:${msg.port}`)
        for (const listener of this.startedListeners) {
          try {
            listener(msg.port, msg.host)
          } catch (err) {
            logger.error('[ApiServerBridge] Started listener error:', err)
          }
        }
        break

      case 'server:stopped':
        this.isRunning = false
        logger.info('[ApiServerBridge] Server stopped')
        for (const listener of this.stoppedListeners) {
          try {
            listener()
          } catch (err) {
            logger.error('[ApiServerBridge] Stopped listener error:', err)
          }
        }
        break

      case 'server:error':
        logger.error('[ApiServerBridge] Error:', msg.message, msg.details)
        for (const listener of this.errorListeners) {
          try {
            listener(msg.message, msg.details)
          } catch (err) {
            logger.error('[ApiServerBridge] Error listener error:', err)
          }
        }
        break

      case 'server:status': {
        const pending = this.pendingRequests.get(msg.requestId)
        if (pending) {
          clearTimeout(pending.timeoutId)
          this.pendingRequests.delete(msg.requestId)
          pending.resolve(msg.status)
        }
        break
      }

      case 'retrieval:search': {
        this.handleRetrievalSearch(msg.requestId, msg.params)
        break
      }

      case 'model:list': {
        this.handleModelList(msg.requestId)
        break
      }

      case 'kg:list-models': {
        this.handleKGModelList(msg.requestId)
        break
      }

      case 'kg:retrieval-search': {
        this.handleKGRetrievalSearch(msg.requestId, msg.params)
        break
      }
    }
  }

  /**
   * 处理 KG 模型列表请求
   */
  private async handleKGModelList(requestId: string): Promise<void> {
    try {
      const modelConfigService = new ModelConfigService()
      const config = await modelConfigService.getConfig()
      const embeddingModels: KGModelInfo[] = []
      const rerankModels: KGModelInfo[] = []
      const seen = new Set<string>()

      for (const p of config.providers || []) {
        if (!p?.enabled || !p.baseUrl || !p.apiKey) continue
        if (!Array.isArray(p.models) || p.models.length === 0) continue

        for (const m of p.models) {
          const id = String(m?.id || '').trim()
          if (!id || seen.has(`${p.id}:${id}`)) continue
          seen.add(`${p.id}:${id}`)

          const info: KGModelInfo = {
            id,
            displayName: m.displayName || id,
            providerId: p.id,
            providerName: p.name,
            type: m.type === 'embedding' ? 'embedding' : 'rerank', // 简单映射，实际可能需要更严谨判断
            dimensions: m.dimensions,
            maxTokens: m.maxTokens
          }

          if (m.type === 'embedding') {
            embeddingModels.push(info)
          } else if (m.type === 'rerank') {
            info.type = 'rerank'
            rerankModels.push(info)
          }
        }
      }

      const result: KGModelsListResult = {
        embeddingModels,
        rerankModels
      }

      this.send({
        type: 'kg:list-models-result',
        requestId,
        success: true,
        data: result
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[ApiServerBridge] kg:list-models failed:', message)
      this.send({
        type: 'kg:list-models-result',
        requestId,
        success: false,
        error: message
      })
    }
  }

  /**
   * 处理 KG 检索请求
   * 负责补全 credentials
   */
  private async handleKGRetrievalSearch(
    requestId: string,
    params: Partial<KGRetrievalParams>
  ): Promise<void> {
    try {
      // 1. 补全 Embedding Config
      if (params.embeddingConfig) {
        const { providerId, modelId, apiKey, baseUrl } = params.embeddingConfig
        // 如果缺少 apiKey 或 baseUrl，尝试从系统配置查找
        if (!apiKey || !baseUrl) {
          const modelConfigService = new ModelConfigService()
          const config = await modelConfigService.getConfig()
          const provider = config.providers.find((p) => p.id === providerId)
          if (provider) {
             if (!baseUrl) params.embeddingConfig.baseUrl = provider.baseUrl
             if (!apiKey) params.embeddingConfig.apiKey = provider.apiKey
             // 同时也尝试补全 headers 如果有的话 (虽然类型里只有 headers Record)
          }
        }
      }

      // 2. 补全 Rerank Config
      if (params.rerank && params.rerank.enabled && params.rerank.providerId) {
        const { providerId, apiKey, baseUrl } = params.rerank
        if (!apiKey || !baseUrl) {
          const modelConfigService = new ModelConfigService()
          const config = await modelConfigService.getConfig()
          const provider = config.providers.find((p) => p.id === providerId)
          if (provider) {
             if (!baseUrl) params.rerank.baseUrl = provider.baseUrl
             if (!apiKey) params.rerank.apiKey = provider.apiKey
          }
        }
      }

      // 3. 补全 LLM Config (Keyword Extraction)
      // 注意：KGRetrievalParams.keywordExtraction 只包含 llmProviderId, 并没有 full config
      // KG 内部 retrievalOrchestrator 会通过 providerId 查找配置，
      // 但前提是 KG 进程持有 providers 列表。
      // KnowledgeGraphBridge.updateModelProviders() 负责同步 providers 到 KG 进程。
      // 所以这里不需要补全 LLM 的 apiKey，只需要确保 KG 进程有最新的 providers。
      // 这是一个假设：KG 进程应该已经同步了 providers。

      // 4. 调用 KG Bridge
      // 强制类型转换为完整参数，假设经过补全后是完整的
      // 实际还需要校验必填项
      if (
        !params.embeddingConfig?.baseUrl ||
        !params.embeddingConfig?.apiKey ||
        !params.embeddingConfig?.dimensions
      ) {
         throw new Error('Missing embedding configuration (provider not found or invalid params)')
      }

      const result = await knowledgeGraphBridge.retrievalSearch(params as KGRetrievalParams)

      this.send({
        type: 'kg:retrieval-result',
        requestId,
        success: true,
        data: result
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[ApiServerBridge] kg:retrieval-search failed:', message)
      this.send({
        type: 'kg:retrieval-result',
        requestId,
        success: false,
        error: message
      })
    }
  }

  /**
   * 列出当前可用的重排模型（脱敏），供 Utility 进程 REST API 对外暴露。
   */
  private async handleModelList(requestId: string): Promise<void> {
    try {
      const modelConfigService = new ModelConfigService()
      const config = await modelConfigService.getConfig()

      const seen = new Set<string>()
      const list: RerankModelInfo[] = []

      for (const p of config.providers || []) {
        // 与 renderer 的 providersReady 逻辑对齐：enabled + 有 baseUrl/apiKey + 有 models
        if (!p?.enabled || !p.baseUrl || !p.apiKey) continue
        if (!Array.isArray(p.models) || p.models.length === 0) continue

        for (const m of p.models) {
          const id = String(m?.id || '').trim()
          if (!id || seen.has(id)) continue
          seen.add(id)

          list.push({
            id,
            displayName: m.displayName || id,
            group: m.group,
            providerId: p.id,
            providerName: p.name,
            protocol: p.protocol
          })
        }
      }

      // 排序：先 provider，再 displayName
      list.sort((a, b) =>
        `${a.providerName}::${a.displayName}`.localeCompare(`${b.providerName}::${b.displayName}`)
      )

      this.send({
        type: 'model:list:result',
        requestId,
        success: true,
        data: list
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[ApiServerBridge] model:list failed:', message)
      this.send({
        type: 'model:list:result',
        requestId,
        success: false,
        error: message
      })
    }
  }

  /**
   * 处理来自 Utility 进程的向量检索请求
   */
  private async handleRetrievalSearch(
    requestId: string,
    params: import('@shared/api-server.types').RetrievalSearchParams
  ): Promise<void> {
    try {
      if (!this.vectorRetrievalService) {
        this.send({
          type: 'retrieval:result',
          requestId,
          success: false,
          error: 'VectorRetrievalService not available'
        })
        return
      }

      const hasRerank = !!params.rerankModelId

      const { results } = hasRerank
        ? await this.vectorRetrievalService.searchWithRerank(params)
        : await this.vectorRetrievalService.search(params)

      if (!results || results.length === 0) {
        this.send({
          type: 'retrieval:result',
          requestId,
          success: false,
          error: 'No recall results'
        })
        return
      }

      // 映射为 RetrievalHit（与 IPC 行为一致）
      const data: RetrievalHit[] = results.map((r) => ({
        id: typeof r.id === 'object' ? String(r.id) : r.id,
        content: r.content,
        chunk_index: r.chunk_index,
        file_key: r.file_key,
        file_name: r.file_name,
        distance: r.distance,
        rerank_score: r.rerank_score
      }))

      this.send({
        type: 'retrieval:result',
        requestId,
        success: true,
        data
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[ApiServerBridge] Retrieval search failed:', message)
      this.send({
        type: 'retrieval:result',
        requestId,
        success: false,
        error: message
      })
    }
  }

  private send(msg: MainToApiServerMessage): void {
    if (!this.process) {
      throw new Error('ApiServer process not started')
    }
    this.process.postMessage(msg)
  }

  private sendWithResponse<T>(msg: MainToApiServerMessage & { requestId: string }): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(msg.requestId)) {
          this.pendingRequests.delete(msg.requestId)
          reject(new Error('Request timeout'))
        }
      }, 30000) // 30 秒超时

      this.pendingRequests.set(msg.requestId, {
        resolve: (value: unknown) => resolve(value as T),
        reject,
        timeoutId
      })
      this.send(msg)
    })
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }
}

// 单例导出
export const apiServerBridge = new ApiServerBridge()

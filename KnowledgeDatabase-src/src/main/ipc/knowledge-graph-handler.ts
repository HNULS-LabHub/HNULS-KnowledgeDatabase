/**
 * @file 知识图谱 IPC Handler
 * @description 处理渲染进程对知识图谱构建的请求，转发到 KnowledgeGraphBridge
 */

import { ipcMain, BrowserWindow } from 'electron'
import { knowledgeGraphBridge } from '../services/knowledge-graph-bridge'
import { logger } from '../services/logger'
import type {
  KGSubmitTaskParams,
  KGCreateSchemaParams,
  KGGraphQueryParams
} from '@shared/knowledge-graph-ipc.types'
import type { KnowledgeLibraryService } from '../services/knowledgeBase-library'
import type { ModelConfigService } from '../services/model-config'
import { KnowledgeConfigService } from '../services/knowledgeBase-library/knowledge-config-service'
import { DocumentService } from '../services/knowledgeBase-library/document-service'

const CH = {
  SUBMIT_TASK: 'knowledge-graph:submit-task',
  QUERY_STATUS: 'knowledge-graph:query-status',
  UPDATE_CONCURRENCY: 'knowledge-graph:update-concurrency',
  CREATE_GRAPH_SCHEMA: 'knowledge-graph:create-graph-schema',
  QUERY_BUILD_STATUS: 'knowledge-graph:query-build-status',
  // 图谱数据查询
  QUERY_GRAPH_DATA: 'knowledge-graph:query-graph-data',
  CANCEL_GRAPH_QUERY: 'knowledge-graph:cancel-graph-query',
  // 嵌入相关
  QUERY_EMBEDDING_STATUS: 'knowledge-graph:query-embedding-status',
  EMBEDDING_PROGRESS: 'knowledge-graph:embedding-progress',
  // 事件
  TASK_PROGRESS: 'knowledge-graph:task-progress',
  TASK_COMPLETED: 'knowledge-graph:task-completed',
  TASK_FAILED: 'knowledge-graph:task-failed',
  BUILD_PROGRESS: 'knowledge-graph:build-progress',
  BUILD_COMPLETED: 'knowledge-graph:build-completed',
  BUILD_FAILED: 'knowledge-graph:build-failed',
  // 图谱数据查询事件
  GRAPH_DATA_BATCH: 'knowledge-graph:graph-data-batch',
  GRAPH_DATA_COMPLETE: 'knowledge-graph:graph-data-complete',
  GRAPH_DATA_ERROR: 'knowledge-graph:graph-data-error',
  GRAPH_DATA_CANCELLED: 'knowledge-graph:graph-data-cancelled'
} as const

/** 向所有渲染窗口广播事件 */
function broadcast(channel: string, ...args: any[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, ...args)
  }
}

let unsubProgress: (() => void) | null = null
let unsubCompleted: (() => void) | null = null
let unsubFailed: (() => void) | null = null
let unsubBuildProgress: (() => void) | null = null
let unsubBuildCompleted: (() => void) | null = null
let unsubBuildFailed: (() => void) | null = null
let unsubGraphDataBatch: (() => void) | null = null
let unsubGraphDataComplete: (() => void) | null = null
let unsubGraphDataError: (() => void) | null = null
let unsubGraphDataCancelled: (() => void) | null = null
let unsubEmbeddingProgress: (() => void) | null = null

export function registerKnowledgeGraphHandlers(
  knowledgeLibraryService?: KnowledgeLibraryService,
  modelConfigService?: ModelConfigService
): void {
  ipcMain.handle(CH.SUBMIT_TASK, async (_event, params: KGSubmitTaskParams) => {
    logger.info('[KG-IPCHandler] submitTask received params:', params)
    try {
      return await knowledgeGraphBridge.submitTask(params)
    } catch (error) {
      logger.error('[KG-IPCHandler] submitTask failed:', error)
      throw error
    }
  })

  ipcMain.handle(CH.QUERY_STATUS, async () => {
    try {
      return await knowledgeGraphBridge.queryStatus()
    } catch (error) {
      logger.error('[KG-IPCHandler] queryStatus failed:', error)
      return []
    }
  })

  ipcMain.handle(CH.UPDATE_CONCURRENCY, async (_event, maxConcurrency: number) => {
    knowledgeGraphBridge.updateConcurrency(maxConcurrency)
  })

  ipcMain.handle(CH.CREATE_GRAPH_SCHEMA, async (_event, params: KGCreateSchemaParams) => {
    logger.info('[KG-IPCHandler] createGraphSchema received:', params)
    try {
      return await knowledgeGraphBridge.createGraphSchema(params)
    } catch (error) {
      logger.error('[KG-IPCHandler] createGraphSchema failed:', error)
      throw error
    }
  })

  ipcMain.handle(CH.QUERY_BUILD_STATUS, async () => {
    try {
      return await knowledgeGraphBridge.queryBuildStatus()
    } catch (error) {
      logger.error('[KG-IPCHandler] queryBuildStatus failed:', error)
      return []
    }
  })

  // 图谱数据流式查询
  ipcMain.handle(CH.QUERY_GRAPH_DATA, async (_event, params: KGGraphQueryParams) => {
    logger.info('[KG-IPCHandler] queryGraphData received:', params)
    try {
      return await knowledgeGraphBridge.queryGraphData(params)
    } catch (error) {
      logger.error('[KG-IPCHandler] queryGraphData failed:', error)
      throw error
    }
  })

  ipcMain.on(CH.CANCEL_GRAPH_QUERY, (_event, sessionId: string) => {
    logger.info('[KG-IPCHandler] cancelGraphQuery:', sessionId)
    knowledgeGraphBridge.cancelGraphQuery(sessionId)
  })

  // 嵌入状态查询
  ipcMain.handle(CH.QUERY_EMBEDDING_STATUS, async () => {
    try {
      return await knowledgeGraphBridge.queryEmbeddingStatus()
    } catch (error) {
      logger.error('[KG-IPCHandler] queryEmbeddingStatus failed:', error)
      return null
    }
  })

  // 订阅 bridge 事件，广播到渲染进程
  unsubProgress = knowledgeGraphBridge.onTaskProgress((taskId, completed, failed, total) => {
    broadcast(CH.TASK_PROGRESS, taskId, completed, failed, total)
  })

  unsubCompleted = knowledgeGraphBridge.onTaskCompleted((taskId) => {
    broadcast(CH.TASK_COMPLETED, taskId)
  })

  unsubFailed = knowledgeGraphBridge.onTaskFailed((taskId, error) => {
    broadcast(CH.TASK_FAILED, taskId, error)
  })

  unsubBuildProgress = knowledgeGraphBridge.onBuildProgress(
    (taskId, completed, failed, total, entitiesTotal, relationsTotal) => {
      broadcast(CH.BUILD_PROGRESS, taskId, completed, failed, total, entitiesTotal, relationsTotal)
    }
  )

  unsubBuildCompleted = knowledgeGraphBridge.onBuildCompleted(
    async (taskId, targetNamespace, targetDatabase, graphTableBase, embeddingConfigId) => {
      broadcast(CH.BUILD_COMPLETED, taskId)

      // 自动触发嵌入：build 完成后，解析嵌入配置并发送 trigger-embedding
      if (!targetNamespace || !targetDatabase || !graphTableBase || !embeddingConfigId) {
        logger.info(
          '[KG-IPCHandler] Build completed but missing target/embedding info, skip auto-trigger'
        )
        return
      }
      if (!knowledgeLibraryService || !modelConfigService) {
        logger.warn('[KG-IPCHandler] Services not injected, skip embedding auto-trigger')
        return
      }

      try {
        // 1. 找到对应的知识库（通过 databaseName 匹配）
        const allKbs = await knowledgeLibraryService.getAll()
        const kb = allKbs.find((k) => k.databaseName === targetDatabase)
        if (!kb || !kb.documentPath) {
          logger.warn(`[KG-IPCHandler] KB not found for database=${targetDatabase}`)
          return
        }

        // 2. 读取知识库配置
        const documentService = new DocumentService()
        await documentService.ensureKnowledgeBaseDirectory(kb.documentPath)
        const kbRoot = documentService.getFullDirectoryPath(kb.documentPath)
        const configService = new KnowledgeConfigService()
        const kbConfig = await configService.readConfig(kbRoot)

        // 3. 找到匹配的 KG 配置
        const kgConfigs = kbConfig.global.knowledgeGraph?.configs ?? []
        const kgConfig = kgConfigs.find((c) => c.graphTableBase === graphTableBase)
        if (!kgConfig) {
          logger.warn(`[KG-IPCHandler] KG config not found for graphTableBase=${graphTableBase}`)
          return
        }

        // 4. 找到嵌入配置
        const embeddingConfigs = kbConfig.global.embedding?.configs ?? []
        const embeddingConfig = embeddingConfigs.find((c) => c.id === embeddingConfigId)
        if (!embeddingConfig || embeddingConfig.candidates.length === 0) {
          logger.warn(`[KG-IPCHandler] Embedding config not found for id=${embeddingConfigId}`)
          return
        }

        const candidate = embeddingConfig.candidates[0]

        // 5. 获取 provider 的 baseUrl 和 apiKey
        const modelConfig = await modelConfigService.getConfig()
        const provider = modelConfig.providers.find((p) => p.id === candidate.providerId)
        if (!provider || !provider.baseUrl || !provider.apiKey) {
          logger.warn(
            `[KG-IPCHandler] Provider not found or missing credentials: ${candidate.providerId}`
          )
          return
        }

        // 6. 构造参数并触发嵌入
        const batchSize = kgConfig.embeddingBatchSize ?? 20
        const maxTokens = kgConfig.embeddingMaxTokens ?? 1500
        const dimensions = embeddingConfig.dimensions ?? 1536

        knowledgeGraphBridge.triggerEmbedding({
          targetNamespace,
          targetDatabase,
          graphTableBase,
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
          model: candidate.modelId,
          dimensions,
          batchSize,
          maxTokens
        })

        logger.info(
          `[KG-IPCHandler] Auto-triggered embedding for ${graphTableBase} (model=${candidate.modelId}, dim=${dimensions}, batch=${batchSize})`
        )
      } catch (error) {
        logger.error('[KG-IPCHandler] Failed to auto-trigger embedding:', error)
      }
    }
  )

  unsubBuildFailed = knowledgeGraphBridge.onBuildFailed((taskId, error) => {
    broadcast(CH.BUILD_FAILED, taskId, error)
  })

  // 图谱数据查询事件
  unsubGraphDataBatch = knowledgeGraphBridge.onGraphDataBatch((data) => {
    broadcast(CH.GRAPH_DATA_BATCH, data)
  })

  unsubGraphDataComplete = knowledgeGraphBridge.onGraphDataComplete((sessionId) => {
    broadcast(CH.GRAPH_DATA_COMPLETE, sessionId)
  })

  unsubGraphDataError = knowledgeGraphBridge.onGraphDataError((sessionId, error) => {
    broadcast(CH.GRAPH_DATA_ERROR, sessionId, error)
  })

  unsubGraphDataCancelled = knowledgeGraphBridge.onGraphDataCancelled((sessionId) => {
    broadcast(CH.GRAPH_DATA_CANCELLED, sessionId)
  })

  // 嵌入进度事件
  unsubEmbeddingProgress = knowledgeGraphBridge.onEmbeddingProgress((data) => {
    broadcast(CH.EMBEDDING_PROGRESS, data)
  })

  logger.info('[KG-IPCHandler] Handlers registered')
}

export function unregisterKnowledgeGraphHandlers(): void {
  ipcMain.removeHandler(CH.SUBMIT_TASK)
  ipcMain.removeHandler(CH.QUERY_STATUS)
  ipcMain.removeHandler(CH.UPDATE_CONCURRENCY)
  ipcMain.removeHandler(CH.CREATE_GRAPH_SCHEMA)
  ipcMain.removeHandler(CH.QUERY_BUILD_STATUS)
  ipcMain.removeHandler(CH.QUERY_GRAPH_DATA)
  ipcMain.removeHandler(CH.QUERY_EMBEDDING_STATUS)
  ipcMain.removeAllListeners(CH.CANCEL_GRAPH_QUERY)
  unsubProgress?.()
  unsubCompleted?.()
  unsubFailed?.()
  unsubBuildProgress?.()
  unsubBuildCompleted?.()
  unsubBuildFailed?.()
  unsubGraphDataBatch?.()
  unsubGraphDataComplete?.()
  unsubGraphDataError?.()
  unsubGraphDataCancelled?.()
  unsubEmbeddingProgress?.()
  logger.info('[KG-IPCHandler] Handlers unregistered')
}

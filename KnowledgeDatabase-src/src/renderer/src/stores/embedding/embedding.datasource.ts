/**
 * 嵌入数据源适配器
 * 调用真实 IPC 与后端通信
 */

import type { FileEmbeddingState, EmbeddingViewConfig } from './embedding.types'
import type {
  SubmitEmbeddingTaskParams,
  ChunkInput,
  EmbeddingTaskResult
} from '@preload/types/embedding.types'

// 判断是否在 Electron 环境中运行
const isElectron = !!(window as any).electron

// 进度监听器映射: documentId -> callback
const progressListeners = new Map<string, (progress: number, processed: number) => void>()

// 完成/失败 Promise 解析器
interface PendingTask {
  resolve: (result: EmbeddingTaskResult) => void
  reject: (error: Error) => void
  config: EmbeddingViewConfig
  fileKey: string
}
const pendingTasks = new Map<string, PendingTask>()

// 初始化全局事件监听器（只初始化一次）
let listenersInitialized = false

function initGlobalListeners(): void {
  if (listenersInitialized || !isElectron) return
  listenersInitialized = true

  // 监听进度事件
  window.electron.ipcRenderer.on(
    'embedding:progress',
    (
      _event: unknown,
      data: {
        documentId: string
        progress: number
        completedChunks: number
        totalChunks: number
      }
    ) => {
      const listener = progressListeners.get(data.documentId)
      if (listener) {
        listener(data.progress, data.completedChunks)
      }
    }
  )

  // 监听完成事件
  window.api.embedding.onEmbeddingCompleted((result: EmbeddingTaskResult) => {
    const pending = pendingTasks.get(result.documentId)
    if (pending) {
      pendingTasks.delete(result.documentId)
      progressListeners.delete(result.documentId)
      pending.resolve(result)
    }
  })

  // 监听失败事件
  window.api.embedding.onEmbeddingFailed((error: { documentId: string; error: string }) => {
    const pending = pendingTasks.get(error.documentId)
    if (pending) {
      pendingTasks.delete(error.documentId)
      progressListeners.delete(error.documentId)
      pending.reject(new Error(error.error))
    }
  })

  console.log('[EmbeddingDataSource] Global listeners initialized')
}

export const EmbeddingDataSource = {
  /**
   * 获取文件的嵌入状态
   * @param fileKey 文件标识
   * @param config 嵌入配置
   * @param _options 可选参数（knowledgeBaseId）
   * @returns 文件嵌入状态
   */
  async getFileEmbeddingState(
    fileKey: string,
    config: EmbeddingViewConfig,
    _options?: { knowledgeBaseId?: number }
  ): Promise<FileEmbeddingState> {
    // 目前返回空状态，嵌入结果存储在 SurrealDB 中
    // TODO: 可以通过 IPC 查询数据库获取已有嵌入状态
    return {
      fileKey,
      config,
      vectors: [],
      status: 'idle'
    }
  },

  /**
   * 执行嵌入操作
   * @param fileKey 文件标识
   * @param config 嵌入配置
   * @param options 嵌入选项
   * @param chunks 分块数据
   * @param onProgress 进度回调
   * @returns 文件嵌入状态
   */
  async startEmbedding(
    fileKey: string,
    config: EmbeddingViewConfig,
    options: {
      knowledgeBaseId: number
      fileRelativePath: string
      totalChunks: number
      fileName?: string
    },
    chunks: ChunkInput[],
    onProgress?: (progress: number, processed: number) => void
  ): Promise<FileEmbeddingState> {
    if (!isElectron) {
      throw new Error('Embedding requires Electron environment')
    }

    // 初始化全局监听器
    initGlobalListeners()

    // 使用 fileKey 作为 documentId
    const documentId = fileKey

    // 注册进度回调
    if (onProgress) {
      progressListeners.set(documentId, onProgress)
    }

    // 构建提交参数
    const params: SubmitEmbeddingTaskParams = {
      documentId,
      chunks,
      embeddingConfig: {
        id: config.configId,
        modelId: config.modelId,
        dimensions: config.dimensions,
        providerId: config.providerId
      },
      meta: {
        fileName: options.fileName || fileKey.split('/').pop() || fileKey,
        knowledgeBaseId: String(options.knowledgeBaseId)
      }
    }

    // 创建 Promise 等待完成
    const resultPromise = new Promise<EmbeddingTaskResult>((resolve, reject) => {
      pendingTasks.set(documentId, {
        resolve,
        reject,
        config,
        fileKey
      })
    })

    try {
      // 提交任务到后端
      const taskId = await window.api.embedding.submitTask(params)
      console.log('[EmbeddingDataSource] Task submitted:', { documentId, taskId })

      // 等待完成
      const result = await resultPromise

      // 转换结果为 FileEmbeddingState
      return {
        fileKey,
        config,
        vectors: result.embeddings.map((e, i) => ({
          id: `vec_${documentId}_${e.index}`,
          content: chunks[e.index]?.text || '',
          vector: e.embedding,
          chunkId: `chunk_${e.index}`
        })),
        status: 'completed',
        progress: 100,
        totalVectors: result.embeddings.length,
        processedVectors: result.embeddings.length,
        lastUpdated: new Date(result.completedAt).toISOString()
      }
    } catch (error) {
      // 清理监听器
      progressListeners.delete(documentId)
      pendingTasks.delete(documentId)

      throw error
    }
  }
}

/**
 * 嵌入数据源适配器
 * 根据环境切换 Mock 数据或真实 IPC 调用
 */

import type { FileEmbeddingState, EmbeddingConfig } from './embedding.types'
import * as mock from './embedding.mock'

// 判断是否在 Electron 环境中运行
const isElectron = !!(window as any).electron

export const EmbeddingDataSource = {
  /**
   * 获取文件的嵌入状态
   * @param fileKey 文件标识
   * @param config 嵌入配置
   * @param options 可选参数（knowledgeBaseId）
   * @returns 文件嵌入状态
   */
  async getFileEmbeddingState(
    fileKey: string,
    config: EmbeddingConfig,
    options?: { knowledgeBaseId?: number }
  ): Promise<FileEmbeddingState> {
    if (isElectron) {
      // 生产环境：调用 IPC
      // const res = await window.api.embedding.getEmbeddingResult({
      //   knowledgeBaseId: options?.knowledgeBaseId,
      //   fileRelativePath: fileKey,
      //   configId: config.configId
      // })
      // if (!res.success || !res.data) {
      //   return {
      //     fileKey,
      //     config,
      //     vectors: [],
      //     status: 'idle'
      //   }
      // }
      // return res.data

      console.warn('[Embedding] IPC not implemented yet, using mock data')
      return await mock.mockGetFileEmbeddingState(fileKey, config.configId)
    } else {
      // 开发环境：调用 Mock 数据
      console.debug('[Dev Mode] Using Mock Data for getFileEmbeddingState')
      return await mock.mockGetFileEmbeddingState(fileKey, config.configId)
    }
  },

  /**
   * 执行嵌入操作
   * @param fileKey 文件标识
   * @param config 嵌入配置
   * @param options 嵌入选项
   * @param onProgress 进度回调
   * @returns 文件嵌入状态
   */
  async startEmbedding(
    fileKey: string,
    config: EmbeddingConfig,
    options: {
      knowledgeBaseId: number
      fileRelativePath: string
      totalChunks: number
    },
    onProgress?: (progress: number, processed: number) => void
  ): Promise<FileEmbeddingState> {
    if (isElectron) {
      // 生产环境：调用 IPC
      // const res = await window.api.embedding.startEmbedding({
      //   knowledgeBaseId: options.knowledgeBaseId,
      //   fileRelativePath: options.fileRelativePath,
      //   configId: config.configId
      // })
      // if (!res.success || !res.data) {
      //   throw new Error(res.error || 'Failed to start embedding')
      // }
      // return res.data

      console.warn('[Embedding] IPC not implemented yet, using mock')
      return await mock.mockStartEmbedding(
        fileKey,
        config.configId,
        options.totalChunks,
        onProgress
      )
    } else {
      // 开发环境：调用 Mock
      console.debug('[Dev Mode] Using Mock Data for startEmbedding')
      return await mock.mockStartEmbedding(
        fileKey,
        config.configId,
        options.totalChunks,
        onProgress
      )
    }
  }
}

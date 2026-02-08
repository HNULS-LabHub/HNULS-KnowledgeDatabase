import type { FileChunkingState, ChunkingConfig } from './chunking.types'
import type { ChunkingRequest } from '@preload/types'

/**
 * 分块数据源适配器
 */
export const ChunkingDataSource = {
  /**
   * 获取文件的分块状态
   * @param fileKey 文件标识
   * @param config 分块配置
   * @param options 可选参数（knowledgeBaseId）
   * @returns 文件分块状态
   */
  async getFileChunkingState(
    fileKey: string,
    config: ChunkingConfig,
    options?: { knowledgeBaseId?: number }
  ): Promise<FileChunkingState> {
    // 确保 config 是纯对象，避免 Vue 响应式代理导致 IPC 序列化失败
    const plainConfig: ChunkingConfig =
      config.mode === 'semantic'
        ? {
            mode: 'semantic',
            maxChars: config.maxChars,
            overlapChars: config.overlapChars
          }
        : {
            mode: 'recursive',
            maxChars: config.maxChars
          }

    if (!options?.knowledgeBaseId) {
      // 如果没有 knowledgeBaseId，返回空状态
      return {
        fileKey,
        config: plainConfig,
        chunks: [],
        lastUpdated: undefined
      }
    }

    const res = await window.api.chunking.getChunkingResult({
      knowledgeBaseId: options.knowledgeBaseId,
      fileRelativePath: fileKey,
      config: plainConfig
    })

    if (!res.success || !res.data) {
      // 没有分块结果，返回空状态
      return {
        fileKey,
        config,
        chunks: [],
        lastUpdated: undefined
      }
    }

    // 转换后端结果到前端状态
    return {
      fileKey: res.data.fileKey,
      config: res.data.config,
      chunks: res.data.chunks.map((chunk) => ({
        id: chunk.id,
        content: chunk.content,
        size: chunk.size,
        index: chunk.index
      })),
      lastUpdated: res.data.updatedAt
    }
  },

  /**
   * 执行分块
   * @param fileKey 文件标识
   * @param config 分块配置
   * @param options 分块选项
   * @returns 文件分块状态
   */
  async chunkDocument(
    fileKey: string,
    config: ChunkingConfig,
    options: {
      knowledgeBaseId: number
      fileRelativePath: string
      parsingVersionId?: string
    }
  ): Promise<FileChunkingState> {
    // 确保 config 是纯对象，避免 Vue 响应式代理导致 IPC 序列化失败
    const plainConfig: ChunkingConfig =
      config.mode === 'semantic'
        ? {
            mode: 'semantic',
            maxChars: config.maxChars,
            overlapChars: config.overlapChars
          }
        : {
            mode: 'recursive',
            maxChars: config.maxChars
          }

    const request: ChunkingRequest = {
      knowledgeBaseId: options.knowledgeBaseId,
      fileRelativePath: options.fileRelativePath,
      config: plainConfig,
      parsingVersionId: options.parsingVersionId
    }

    const res = await window.api.chunking.chunkDocument(request)

    if (!res.success || !res.data) {
      throw new Error(res.error || 'Failed to chunk document')
    }

    // 转换后端结果到前端状态
    return {
      fileKey: res.data.fileKey,
      config: res.data.config,
      chunks: res.data.chunks.map((chunk) => ({
        id: chunk.id,
        content: chunk.content,
        size: chunk.size,
        index: chunk.index
      })),
      lastUpdated: res.data.updatedAt
    }
  }
}

import type { FileChunkingState, ChunkingConfig } from './chunking.types'
import { mockChunkingState } from './chunking.mock'

/**
 * 分块数据源适配器
 * 目前使用 mock 数据，后续对接后端 API
 */
export const ChunkingDataSource = {
  /**
   * 获取文件的分块状态
   * @param fileKey 文件标识
   * @param config 分块配置
   * @returns 文件分块状态
   */
  async getFileChunkingState(fileKey: string, config: ChunkingConfig): Promise<FileChunkingState> {
    // TODO: 后续对接后端 API
    // const res = await window.api.chunking.getFileChunkingState({
    //   fileKey,
    //   config
    // })
    // if (!res.success || !res.data) {
    //   throw new Error(res.error || 'Failed to get chunking state')
    // }
    // return res.data

    // 目前使用 mock 数据
    return mockChunkingState(fileKey, config)
  }
}

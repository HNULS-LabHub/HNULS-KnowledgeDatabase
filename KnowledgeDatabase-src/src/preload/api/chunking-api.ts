/**
 * 分块服务 API（Preload）
 *
 * IPC 调用范例（在 renderer 进程中使用）：
 * ```typescript
 * import { chunkingAPI } from '@preload/api'
 *
 * // 执行分块
 * const result = await chunkingAPI.chunkDocument({
 *   knowledgeBaseId: 1,
 *   fileRelativePath: 'documents/example.pdf',
 *   config: {
 *     mode: 'recursive',
 *     maxChars: 1000
 *   },
 *   parsingVersionId: 'version-1' // 非纯文本文件需要指定
 * })
 *
 * if (result.success && result.data) {
 *   console.log('分块成功，共', result.data.chunks.length, '个分块')
 * } else {
 *   console.error('分块失败:', result.error)
 * }
 *
 * // 获取分块结果
 * const getResult = await chunkingAPI.getChunkingResult({
 *   knowledgeBaseId: 1,
 *   fileRelativePath: 'documents/example.pdf',
 *   config: {
 *     mode: 'recursive',
 *     maxChars: 1000
 *   }
 * })
 *
 * if (getResult.success && getResult.data) {
 *   console.log('获取到', getResult.data.chunks.length, '个分块')
 * }
 * ```
 */
import { ipcRenderer } from 'electron'
import type {
  ChunkingAPI,
  ChunkingRequest,
  GetChunkingResultRequest,
  ChunkingResult,
  APIResponse
} from '../types'

export const chunkingAPI: ChunkingAPI = {
  chunkDocument: (req: ChunkingRequest): Promise<APIResponse<ChunkingResult>> => {
    return ipcRenderer.invoke('chunking:chunkdocument', req)
  },

  getChunkingResult: (
    req: GetChunkingResultRequest
  ): Promise<APIResponse<ChunkingResult | null>> => {
    return ipcRenderer.invoke('chunking:getchunkingresult', req)
  }
}

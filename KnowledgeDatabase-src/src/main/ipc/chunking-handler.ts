/**
 * 分块服务 IPC Handler
 *
 * IPC 调用范例（前端调用）：
 * ```typescript
 * // 在 renderer 进程中使用
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
import { IpcMainInvokeEvent } from 'electron'
import { BaseIPCHandler } from './base-handler'
import { ChunkingService } from '../services/chunking'
import type {
  ChunkingRequest,
  GetChunkingResultRequest,
  ChunkingResult
} from '../services/chunking'

export class ChunkingIPCHandler extends BaseIPCHandler {
  constructor(private readonly chunkingService: ChunkingService) {
    super()
    this.register()
  }

  protected getChannelPrefix(): string {
    return 'chunking'
  }

  /**
   * 执行分块
   * IPC Channel: chunking:chunkdocument
   */
  async handleChunkdocument(
    _event: IpcMainInvokeEvent,
    req: ChunkingRequest
  ): Promise<{ success: boolean; data?: ChunkingResult; error?: string }> {
    try {
      const data = await this.chunkingService.chunkDocument(req)
      return { success: true, data }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
    }
  }

  /**
   * 获取分块结果
   * IPC Channel: chunking:getchunkingresult
   */
  async handleGetchunkingresult(
    _event: IpcMainInvokeEvent,
    req: GetChunkingResultRequest
  ): Promise<{ success: boolean; data?: ChunkingResult | null; error?: string }> {
    try {
      const data = await this.chunkingService.getChunkingResult(req)
      return { success: true, data }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
    }
  }
}

import { IpcMainInvokeEvent } from 'electron'
import { BaseIPCHandler } from './base-handler'
import { logger } from '../services/logger'
import { VectorRetrievalService } from '../services/vector-retrieval'
import type { VectorRetrievalSearchParams, VectorRetrievalHit } from '../services/vector-retrieval'

/**
 * 向量召回 IPC Handler
 *
 * 要求：
 * - 必须传入 knowledgeBaseId + vector tableName（每个向量表独立 HNSW 索引）
 * - IPC 收到调用信息与召回结果用 info 级别日志记录
 * - 召回不到（0 条结果）视为 error
 */
export class VectorRetrievalIPCHandler extends BaseIPCHandler {
  constructor(private readonly vectorRetrievalService: VectorRetrievalService) {
    super()
    this.register()
  }

  protected getChannelPrefix(): string {
    return 'vector-retrieval'
  }

  async handleSearch(
    _event: IpcMainInvokeEvent,
    params: VectorRetrievalSearchParams
  ): Promise<{ success: boolean; data?: VectorRetrievalHit[]; error?: string }> {
    const queryText = String(params?.queryText || '')
    const queryPreview = queryText.length > 200 ? queryText.slice(0, 200) + '…' : queryText
    const hasRerank = !!params?.rerankModelId

    logger.info('[VectorRetrievalIPC] search called', {
      knowledgeBaseId: params?.knowledgeBaseId,
      tableName: params?.tableName,
      k: params?.k,
      ef: params?.ef,
      rerankModelId: params?.rerankModelId || null,
      queryPreview
    })

    try {
      // 根据是否传入 rerankModelId 路由到不同方法
      const { results, resolved } = hasRerank
        ? await this.vectorRetrievalService.searchWithRerank(params)
        : await this.vectorRetrievalService.search(params)

      if (!results || results.length === 0) {
        logger.error('[VectorRetrievalIPC] no recall results', {
          ...resolved,
          queryPreview
        })
        return { success: false, error: 'No recall results' }
      }

      logger.info('[VectorRetrievalIPC] recall succeeded', {
        ...resolved,
        resultCount: results.length,
        hasRerank,
        top: results.slice(0, Math.min(3, results.length)).map((r) => ({
          id: r.id,
          file_key: r.file_key,
          file_name: r.file_name,
          chunk_index: r.chunk_index,
          distance: r.distance,
          rerank_score: r.rerank_score
        }))
      })

      return { success: true, data: results }
    } catch (error) {
      logger.error('[VectorRetrievalIPC] search failed', {
        error: error instanceof Error ? error.message : String(error),
        hasRerank
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

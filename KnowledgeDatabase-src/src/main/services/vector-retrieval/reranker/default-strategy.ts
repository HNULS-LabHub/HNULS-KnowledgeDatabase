/**
 * @file 默认重排策略
 * @description 兼容 OpenAI 格式的重排 API（Cohere / Jina / BGE / SiliconFlow 等通用）
 */

import type { RerankStrategy, RerankResult } from './types'

export class DefaultStrategy implements RerankStrategy {
  buildUrl(baseURL: string): string {
    const trimmed = baseURL.trim().replace(/\/$/, '')
    if (trimmed.endsWith('/v1')) {
      return `${trimmed}/rerank`
    }
    return `${trimmed}/v1/rerank`
  }

  buildRequestBody(
    query: string,
    documents: string[],
    topN: number,
    model: string
  ): Record<string, unknown> {
    return {
      model,
      query,
      documents,
      top_n: topN
    }
  }

  extractResults(data: unknown): RerankResult[] {
    const obj = data as Record<string, unknown>
    const results = obj?.results
    if (!Array.isArray(results)) {
      return []
    }
    return results
      .filter((r: any) => typeof r?.index === 'number' && typeof r?.relevance_score === 'number')
      .map((r: any) => ({
        index: r.index as number,
        relevance_score: r.relevance_score as number
      }))
  }
}

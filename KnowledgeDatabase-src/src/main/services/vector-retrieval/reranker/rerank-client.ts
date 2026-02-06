/**
 * @file 重排客户端
 * @description 通过策略模式调用重排 API，支持多种重排服务
 */

import { logger } from '../../logger'
import type { RerankParams, RerankResult, RerankStrategy } from './types'
import { DefaultStrategy } from './default-strategy'

export class RerankClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message)
    this.name = 'RerankClientError'
  }
}

export class RerankClient {
  private readonly strategy: RerankStrategy

  constructor(strategy?: RerankStrategy) {
    this.strategy = strategy ?? new DefaultStrategy()
  }

  /**
   * 执行重排请求
   * @returns 按 relevance_score 降序排列的重排结果
   */
  async rerank(params: RerankParams): Promise<RerankResult[]> {
    const { baseUrl, apiKey, model, query, documents, topN, headers } = params

    if (!documents || documents.length === 0) {
      return []
    }

    const url = this.strategy.buildUrl(baseUrl)
    const body = this.strategy.buildRequestBody(query, documents, topN, model)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30_000)

    try {
      logger.info('[RerankClient] Sending rerank request', {
        url,
        model,
        documentCount: documents.length,
        topN
      })

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          ...(headers || {})
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const data = await response.json()

      if (!response.ok) {
        const errMsg =
          (data as any)?.error?.message ||
          (data as any)?.message ||
          `HTTP ${response.status}: ${response.statusText}`
        throw new RerankClientError(errMsg, response.status)
      }

      const results = this.strategy.extractResults(data)

      // 按 relevance_score 降序
      results.sort((a, b) => b.relevance_score - a.relevance_score)

      logger.info('[RerankClient] Rerank completed', {
        model,
        inputCount: documents.length,
        outputCount: results.length,
        topScore: results[0]?.relevance_score,
        bottomScore: results[results.length - 1]?.relevance_score
      })

      return results
    } catch (err) {
      clearTimeout(timeoutId)

      if (err instanceof RerankClientError) {
        throw err
      }

      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new RerankClientError('Rerank request timeout (30s)', undefined)
        }
        throw new RerankClientError(err.message, undefined)
      }

      throw new RerankClientError('Unknown rerank error')
    }
  }
}

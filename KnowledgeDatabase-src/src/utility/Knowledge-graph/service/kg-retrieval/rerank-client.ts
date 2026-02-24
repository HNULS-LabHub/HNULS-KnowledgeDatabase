/**
 * @file 重排客户端（Utility 进程专用）
 * @description 通过策略模式调用重排 API，支持 OpenAI 兼容的重排服务
 *              移植自 main/services/vector-retrieval/reranker，独立运行在 utility 进程中
 */

import type { RerankResult, RerankStrategy, RerankCallConfig } from './types'

// ============================================================================
// 日志
// ============================================================================

const log = (msg: string, data?: any): void => {
  if (data) {
    console.log(`[KG-RerankClient] ${msg}`, data)
  } else {
    console.log(`[KG-RerankClient] ${msg}`)
  }
}

const logError = (msg: string, error?: any): void => {
  console.error(`[KG-RerankClient] ${msg}`, error)
}

// ============================================================================
// 错误类
// ============================================================================

export class KGRerankClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message)
    this.name = 'KGRerankClientError'
  }
}

// ============================================================================
// 默认策略：兼容 OpenAI 格式的重排 API（Cohere / Jina / BGE / SiliconFlow 等通用）
// ============================================================================

class DefaultRerankStrategy implements RerankStrategy {
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

// ============================================================================
// KGRerankClient
// ============================================================================

export class KGRerankClient {
  private readonly strategy: RerankStrategy

  constructor(strategy?: RerankStrategy) {
    this.strategy = strategy ?? new DefaultRerankStrategy()
  }

  /**
   * 执行重排请求
   * @param config 重排 API 配置
   * @param query 查询文本
   * @param documents 待重排的文档内容列表
   * @returns 按 relevance_score 降序排列的重排结果
   */
  async rerank(
    config: RerankCallConfig,
    query: string,
    documents: string[]
  ): Promise<RerankResult[]> {
    if (!documents || documents.length === 0) {
      return []
    }

    const url = this.strategy.buildUrl(config.baseUrl)
    const body = this.strategy.buildRequestBody(query, documents, config.topN, config.model)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30_000)

    try {
      log('Sending rerank request', {
        url,
        model: config.model,
        documentCount: documents.length,
        topN: config.topN
      })

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
          ...(config.headers || {})
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
        throw new KGRerankClientError(errMsg, response.status)
      }

      const results = this.strategy.extractResults(data)

      // 按 relevance_score 降序
      results.sort((a, b) => b.relevance_score - a.relevance_score)

      log('Rerank completed', {
        model: config.model,
        inputCount: documents.length,
        outputCount: results.length,
        topScore: results[0]?.relevance_score,
        bottomScore: results[results.length - 1]?.relevance_score
      })

      return results
    } catch (err) {
      clearTimeout(timeoutId)

      if (err instanceof KGRerankClientError) {
        throw err
      }

      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new KGRerankClientError('Rerank request timeout (30s)', undefined)
        }
        throw new KGRerankClientError(err.message, undefined)
      }

      throw new KGRerankClientError('Unknown rerank error')
    }
  }
}

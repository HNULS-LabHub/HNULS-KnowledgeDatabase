/**
 * @file OpenAI Client
 * @description OpenAI 兼容 API 的嵌入请求封装
 */

import type { EmbeddingRequestParams } from '../types'

// ============================================================================
// 类型定义
// ============================================================================

interface OpenAIEmbeddingResponse {
  object: string
  data: Array<{
    object: string
    index: number
    embedding: number[]
  }>
  model: string
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
}

interface OpenAIErrorResponse {
  error: {
    message: string
    type: string
    code: string | number
  }
}

// ============================================================================
// 错误类
// ============================================================================

export class OpenAIClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly errorCode?: string | number
  ) {
    super(message)
    this.name = 'OpenAIClientError'
  }

  /**
   * 是否是客户端错误（不应重试）
   */
  isClientError(): boolean {
    return this.statusCode !== undefined && this.statusCode >= 400 && this.statusCode < 500
  }

  /**
   * 是否是速率限制错误
   */
  isRateLimitError(): boolean {
    return this.statusCode === 429
  }

  /**
   * 是否是服务端错误（可以重试）
   */
  isServerError(): boolean {
    return this.statusCode !== undefined && this.statusCode >= 500
  }
}

// ============================================================================
// OpenAI Client
// ============================================================================

export class OpenAIClient {
  /**
   * 创建嵌入向量
   */
  async createEmbedding(params: EmbeddingRequestParams): Promise<number[]> {
    const { baseUrl, apiKey, model, input, dimensions } = params

    // 构建请求 URL
    const url = `${baseUrl.replace(/\/$/, '')}/v1/embeddings`

    // 构建请求体
    const body: Record<string, unknown> = {
      model,
      input
    }

    // 如果指定了维度，添加到请求体
    if (dimensions !== undefined) {
      body.dimensions = dimensions
    }

    // 发送请求
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30秒超时

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // 解析响应
      const data = await response.json()

      if (!response.ok) {
        const errorData = data as OpenAIErrorResponse
        throw new OpenAIClientError(
          errorData.error?.message || `HTTP ${response.status}`,
          response.status,
          errorData.error?.code
        )
      }

      const embeddingResponse = data as OpenAIEmbeddingResponse

      // 返回第一个嵌入向量
      if (embeddingResponse.data && embeddingResponse.data.length > 0) {
        return embeddingResponse.data[0].embedding
      }

      throw new OpenAIClientError('No embedding returned in response')
    } catch (err) {
      clearTimeout(timeoutId)

      if (err instanceof OpenAIClientError) {
        throw err
      }

      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new OpenAIClientError('Request timeout', undefined, 'TIMEOUT')
        }
        throw new OpenAIClientError(err.message, undefined, 'NETWORK_ERROR')
      }

      throw new OpenAIClientError('Unknown error')
    }
  }
}

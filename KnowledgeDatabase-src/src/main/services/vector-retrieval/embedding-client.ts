/**
 * @file 向量召回嵌入客户端
 * @description 在 Main 进程中调用 OpenAI 兼容 embeddings 接口，生成查询向量
 */

import { logger } from '../logger'

export class EmbeddingClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly errorCode?: string | number
  ) {
    super(message)
    this.name = 'EmbeddingClientError'
  }

  isClientError(): boolean {
    return this.statusCode !== undefined && this.statusCode >= 400 && this.statusCode < 500
  }

  isRateLimitError(): boolean {
    return this.statusCode === 429
  }
}

interface OpenAIEmbeddingResponse {
  object: string
  data: Array<{
    object: string
    index: number
    embedding: number[]
  }>
  model: string
}

interface OpenAIErrorResponse {
  error?: {
    message?: string
    type?: string
    code?: string | number
  }
}

export interface CreateEmbeddingParams {
  baseUrl: string
  apiKey: string
  model: string
  input: string
  dimensions?: number
  headers?: Record<string, string>
}

export class OpenAICompatibleEmbeddingClient {
  async createEmbedding(params: CreateEmbeddingParams): Promise<number[]> {
    const { baseUrl, apiKey, model, input, dimensions, headers } = params

    const url = `${baseUrl.trim().replace(/\/$/, '')}/v1/embeddings`

    const body: Record<string, unknown> = {
      model,
      input
    }

    if (dimensions !== undefined) {
      body.dimensions = dimensions
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
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

      const data = (await response.json()) as unknown

      if (!response.ok) {
        const err = data as OpenAIErrorResponse
        throw new EmbeddingClientError(
          err.error?.message || `HTTP ${response.status}`,
          response.status,
          err.error?.code
        )
      }

      const ok = data as OpenAIEmbeddingResponse
      const embedding = ok.data?.[0]?.embedding
      if (Array.isArray(embedding) && embedding.length > 0) {
        return embedding
      }

      throw new EmbeddingClientError('No embedding returned in response')
    } catch (err) {
      clearTimeout(timeoutId)

      if (err instanceof EmbeddingClientError) {
        throw err
      }

      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new EmbeddingClientError('Request timeout', undefined, 'TIMEOUT')
        }
        throw new EmbeddingClientError(err.message, undefined, 'NETWORK_ERROR')
      }

      throw new EmbeddingClientError('Unknown error')
    } finally {
      // debug-level: do not leak apiKey
      logger.debug('[VectorRetrieval] Embedding request finished', {
        model,
        baseUrl,
        inputLength: input?.length,
        dimensions
      })
    }
  }
}

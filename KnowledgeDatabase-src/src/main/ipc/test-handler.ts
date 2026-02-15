import { IpcMainInvokeEvent } from 'electron'
import { BaseIPCHandler } from './base-handler'
import { ModelConfigService } from '../services/model-config/model-config-service'
import { logger } from '../services/logger'

// ============================================================================
// 类型定义
// ============================================================================

interface LLMChatRequest {
  providerId: string
  modelId: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  maxTokens?: number
}

interface LLMChatResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

// ============================================================================
// TestIPCHandler
// ============================================================================

export class TestIPCHandler extends BaseIPCHandler {
  private modelConfigService: ModelConfigService

  constructor(modelConfigService?: ModelConfigService) {
    super()
    this.modelConfigService = modelConfigService ?? new ModelConfigService()
    this.register()
  }

  protected getChannelPrefix(): string {
    return 'test'
  }

  async handlePing(
    _event: IpcMainInvokeEvent
  ): Promise<{ success: boolean; message: string; timestamp: number }> {
    console.log('Received ping from renderer')
    return {
      success: true,
      message: 'pong',
      timestamp: Date.now()
    }
  }

  async handleEcho(
    _event: IpcMainInvokeEvent,
    message: string
  ): Promise<{ success: boolean; echo: string }> {
    return {
      success: true,
      echo: `Echo: ${message}`
    }
  }

  /**
   * LLM Chat 测试
   */
  async handleLlmchat(
    _event: IpcMainInvokeEvent,
    request: LLMChatRequest
  ): Promise<LLMChatResponse> {
    logger.info('LLM chat request', {
      providerId: request.providerId,
      modelId: request.modelId,
      messageCount: request.messages.length
    })

    try {
      const config = await this.modelConfigService.getConfig()

      // 查找 provider
      const provider = config.providers?.find((p) => p.id === request.providerId)
      if (!provider || !provider.enabled) {
        throw new Error(`Provider not found or disabled: ${request.providerId}`)
      }

      if (!provider.baseUrl || !provider.apiKey) {
        throw new Error(`Provider ${request.providerId} missing baseUrl or apiKey`)
      }

      // 构建请求
      const baseURL = provider.baseUrl.replace(/\/$/, '')
      const url = `${baseURL}/v1/chat/completions`

      const body = {
        model: request.modelId,
        messages: request.messages,
        temperature: request.temperature ?? 0,
        max_tokens: request.maxTokens
      }

      logger.info('Calling LLM API', { url, model: request.modelId })

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
          ...provider.defaultHeaders
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`LLM API error: ${response.status} ${errorText}`)
      }

      const data = await response.json()

      const result: LLMChatResponse = {
        content: data.choices?.[0]?.message?.content ?? '',
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens
            }
          : undefined
      }

      logger.info('LLM chat response', {
        contentLength: result.content.length,
        usage: result.usage
      })

      return result
    } catch (error) {
      logger.error('LLM chat failed', error)
      throw error
    }
  }
}

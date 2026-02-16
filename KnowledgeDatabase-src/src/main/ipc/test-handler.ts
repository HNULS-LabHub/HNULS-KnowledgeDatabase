import { IpcMainInvokeEvent, ipcMain } from 'electron'
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

interface LLMStreamRequest extends LLMChatRequest {
  sessionId: string
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
    this.registerStreamHandler()
  }

  protected getChannelPrefix(): string {
    return 'test'
  }

  private registerStreamHandler(): void {
    // 流式 LLM 调用（单独注册，不走 BaseIPCHandler）
    // 先移除可能存在的旧 handler（热重载时）
    try {
      ipcMain.removeHandler('test:llmstream')
    } catch {
      // 忽略不存在的情况
    }
    ipcMain.handle('test:llmstream', async (event, request: LLMStreamRequest) => {
      return this.handleLlmStream(event, request)
    })
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
   * LLM Chat 测试（非流式）
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

  /**
   * LLM 流式调用
   */
  private async handleLlmStream(
    event: IpcMainInvokeEvent,
    request: LLMStreamRequest
  ): Promise<{ success: boolean; error?: string }> {
    const { sessionId } = request

    logger.info('LLM stream request', {
      sessionId,
      providerId: request.providerId,
      modelId: request.modelId
    })

    try {
      const config = await this.modelConfigService.getConfig()

      const provider = config.providers?.find((p) => p.id === request.providerId)
      if (!provider || !provider.enabled) {
        throw new Error(`Provider not found or disabled: ${request.providerId}`)
      }

      if (!provider.baseUrl || !provider.apiKey) {
        throw new Error(`Provider ${request.providerId} missing baseUrl or apiKey`)
      }

      const baseURL = provider.baseUrl.replace(/\/$/, '')
      const url = `${baseURL}/v1/chat/completions`

      const body = {
        model: request.modelId,
        messages: request.messages,
        temperature: request.temperature ?? 0,
        max_tokens: request.maxTokens,
        stream: true
      }

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

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue
          if (!trimmed.startsWith('data: ')) continue

          try {
            const json = JSON.parse(trimmed.slice(6))
            const delta = json.choices?.[0]?.delta

            if (delta) {
              // 检查是否有 reasoning_content（思考过程）
              if (delta.reasoning_content) {
                event.sender.send('test:llmstream:chunk', {
                  sessionId,
                  type: 'reasoning',
                  content: delta.reasoning_content
                })
              }

              // 正常内容
              if (delta.content) {
                event.sender.send('test:llmstream:chunk', {
                  sessionId,
                  type: 'content',
                  content: delta.content
                })
              }
            }

            // 检查 usage（某些 API 在最后一个 chunk 返回）
            if (json.usage) {
              event.sender.send('test:llmstream:chunk', {
                sessionId,
                type: 'usage',
                usage: {
                  promptTokens: json.usage.prompt_tokens,
                  completionTokens: json.usage.completion_tokens,
                  totalTokens: json.usage.total_tokens
                }
              })
            }
          } catch {
            // 忽略解析错误
          }
        }
      }

      // 发送完成信号
      event.sender.send('test:llmstream:done', { sessionId })

      logger.info('LLM stream completed', { sessionId })
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error('LLM stream failed', { sessionId, error: message })

      event.sender.send('test:llmstream:error', { sessionId, error: message })
      return { success: false, error: message }
    }
  }
}

import { ipcRenderer } from 'electron'

// ============================================================================
// 类型定义
// ============================================================================

export interface LLMChatRequest {
  providerId: string
  modelId: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  maxTokens?: number
}

export interface LLMChatResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface LLMStreamRequest extends LLMChatRequest {
  sessionId: string
}

export interface LLMStreamChunk {
  sessionId: string
  type: 'reasoning' | 'content' | 'usage'
  content?: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

// ============================================================================
// API
// ============================================================================

export const testAPI = {
  /**
   * 发送 ping 请求到主进程
   */
  ping: (): Promise<{ success: boolean; message: string; timestamp: number }> => {
    return ipcRenderer.invoke('test:ping')
  },

  /**
   * 发送 echo 请求到主进程
   */
  echo: (message: string): Promise<{ success: boolean; echo: string }> => {
    return ipcRenderer.invoke('test:echo', message)
  },

  /**
   * LLM 对话测试（非流式）
   */
  llmChat: (request: LLMChatRequest): Promise<LLMChatResponse> => {
    return ipcRenderer.invoke('test:llmchat', request)
  },

  /**
   * LLM 流式对话
   */
  llmStream: (request: LLMStreamRequest): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('test:llmstream', request)
  },

  /**
   * 监听流式 chunk
   */
  onLlmStreamChunk: (callback: (chunk: LLMStreamChunk) => void): (() => void) => {
    const handler = (_event: any, chunk: LLMStreamChunk) => callback(chunk)
    ipcRenderer.on('test:llmstream:chunk', handler)
    return () => ipcRenderer.removeListener('test:llmstream:chunk', handler)
  },

  /**
   * 监听流式完成
   */
  onLlmStreamDone: (callback: (data: { sessionId: string }) => void): (() => void) => {
    const handler = (_event: any, data: { sessionId: string }) => callback(data)
    ipcRenderer.on('test:llmstream:done', handler)
    return () => ipcRenderer.removeListener('test:llmstream:done', handler)
  },

  /**
   * 监听流式错误
   */
  onLlmStreamError: (callback: (data: { sessionId: string; error: string }) => void): (() => void) => {
    const handler = (_event: any, data: { sessionId: string; error: string }) => callback(data)
    ipcRenderer.on('test:llmstream:error', handler)
    return () => ipcRenderer.removeListener('test:llmstream:error', handler)
  }
}

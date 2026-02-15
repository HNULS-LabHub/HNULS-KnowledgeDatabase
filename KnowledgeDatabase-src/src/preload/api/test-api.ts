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
   * LLM 对话测试
   */
  llmChat: (request: LLMChatRequest): Promise<LLMChatResponse> => {
    return ipcRenderer.invoke('test:llmchat', request)
  }
}

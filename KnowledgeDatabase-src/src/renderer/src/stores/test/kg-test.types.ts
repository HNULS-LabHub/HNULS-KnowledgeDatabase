/**
 * @file 知识图谱测试 - 类型定义
 */

/** LLM 消息 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** LLM 请求参数 */
export interface LLMChatRequest {
  providerId: string
  modelId: string
  messages: LLMMessage[]
  temperature?: number
  maxTokens?: number
}

/** LLM 响应 */
export interface LLMChatResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/** 测试配置 */
export interface KgTestConfig {
  entityTypes: string[]
  outputLanguage: string
  providerId: string
  modelId: string
  inputText: string
}

/** 测试状态 */
export type KgTestStatus = 'idle' | 'loading' | 'success' | 'error'

/** 测试结果 */
export interface KgTestResult {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  error?: string
  timestamp: number
}

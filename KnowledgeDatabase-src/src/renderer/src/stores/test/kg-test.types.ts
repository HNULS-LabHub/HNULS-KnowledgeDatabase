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

/** LLM 流式请求参数 */
export interface LLMStreamRequest extends LLMChatRequest {
  sessionId: string
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

/** 流式 chunk */
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

/** 测试配置 */
export interface KgTestConfig {
  entityTypes: string[]
  outputLanguage: string
  inputText: string
}

/** 选中的模型 */
export interface SelectedModel {
  providerId: string
  modelId: string
}

/** 单个模型的测试状态 */
export type ModelTestStatus = 'idle' | 'loading' | 'success' | 'error'

/** 单个模型的测试结果 */
export interface ModelTestResult {
  sessionId: string
  modelId: string
  providerId: string
  status: ModelTestStatus
  // 流式内容
  reasoning: string
  content: string
  // 计时
  startTime: number
  firstTokenTime: number | null
  endTime: number | null
  // 统计
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  error?: string
}

/** 计算后的性能指标 */
export interface ModelMetrics {
  totalTime: number | null // 总耗时 ms
  firstTokenTime: number | null // 首字时间 ms
  tokensPerSecond: number | null // tokens/s
}

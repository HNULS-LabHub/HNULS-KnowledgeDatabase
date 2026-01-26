/**
 * @file 嵌入引擎内部类型定义
 * @description 仅在 Utility Process 内部使用的类型
 */

// ============================================================================
// 任务状态
// ============================================================================

export type DocumentTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled'
export type ChunkTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'retrying'

// ============================================================================
// 文档级任务
// ============================================================================

/**
 * 文档级任务
 */
export interface DocumentTask {
  /** 文档唯一标识 */
  documentId: string
  /** 关联的全局监控任务 ID */
  taskId: string
  /** 总 chunk 数 */
  totalChunks: number
  /** 已完成数 */
  completedChunks: number
  /** 失败数 */
  failedChunks: number
  /** 任务状态 */
  status: DocumentTaskStatus
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
  /** 嵌入配置 */
  embeddingConfig: {
    modelId: string
    dimensions?: number
  }
  /** 可选元数据 */
  meta?: {
    fileName?: string
    knowledgeBaseId?: string
  }
}

// ============================================================================
// Chunk 级任务
// ============================================================================

/**
 * Chunk 级任务
 */
export interface ChunkTask {
  /** chunk 唯一标识 (documentId:index) */
  chunkId: string
  /** 所属文档 ID */
  documentId: string
  /** 在文档中的序号 */
  index: number
  /** 待嵌入的文本 */
  text: string
  /** 任务状态 */
  status: ChunkTaskStatus
  /** 重试次数 */
  retryCount: number
  /** 生成的向量 (完成后填充) */
  embedding?: number[]
  /** 错误信息 */
  error?: string
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
}

// ============================================================================
// Channel 配置
// ============================================================================

export type ChannelStatusType = 'active' | 'degraded' | 'blacklisted'

/**
 * 单个通道配置
 */
export interface ChannelConfig {
  /** 通道 ID */
  id: string
  /** 对应的 Provider ID */
  providerId: string
  /** Provider 名称 */
  providerName: string
  /** 优先级 (0 最高) */
  priority: number
  /** API 基地址 */
  baseUrl: string
  /** API 密钥 */
  apiKey: string
  /** 模型名称 */
  model: string

  /** 通道状态 */
  status: ChannelStatusType
  /** 连续失败次数 */
  failureCount: number
  /** 最后失败时间 */
  lastFailedAt?: number
  /** 黑名单解除时间 */
  blacklistedUntil?: number

  /** 单次请求最大重试次数 */
  maxRetries: number
  /** 请求超时时间 (ms) */
  timeout: number
}

// ============================================================================
// 嵌入请求参数
// ============================================================================

/**
 * OpenAI 嵌入请求参数
 */
export interface EmbeddingRequestParams {
  /** API 基地址 */
  baseUrl: string
  /** API 密钥 */
  apiKey: string
  /** 模型名称 */
  model: string
  /** 输入文本 */
  input: string
  /** 可选: 向量维度 */
  dimensions?: number
}

// ============================================================================
// 调度器配置
// ============================================================================

/**
 * 调度器配置
 */
export interface SchedulerConfig {
  /** 最大并发数 */
  maxConcurrency: number
}

// ============================================================================
// 熔断配置
// ============================================================================

/**
 * 熔断配置
 */
export interface CircuitBreakerConfig {
  /** 触发熔断的连续失败次数 */
  failureThreshold: number
  /** 黑名单时长 (ms) */
  blacklistDuration: number
}

// ============================================================================
// 默认配置
// ============================================================================

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  maxConcurrency: 3
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  blacklistDuration: 5 * 60 * 1000 // 5 分钟
}

export const DEFAULT_CHANNEL_CONFIG: Partial<ChannelConfig> = {
  status: 'active',
  failureCount: 0,
  maxRetries: 0, // 不在单个 channel 重试，直接切换
  timeout: 30000
}

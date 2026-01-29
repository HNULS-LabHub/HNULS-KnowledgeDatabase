/**
 * @file 嵌入服务类型定义
 * @description 从 @shared/embedding.types 重新导出，保持 preload 层兼容性
 * 注意：排除 EmbeddingConfig 以避免与 knowledge-config.types 冲突
 */

// 重新导出类型，排除与 knowledge-config.types 冲突的 EmbeddingConfig
export type {
  // 任务状态类型
  DocumentTaskStatus,
  ChunkTaskStatus,
  EmbeddingTaskStatus,
  ChannelStatusType,
  // Chunk 相关类型
  ChunkInput,
  ChunkEmbeddingResult,
  ChunkTask,
  // 文档级任务
  DocumentTask,
  // 嵌入任务提交与结果
  SubmitEmbeddingTaskParams,
  EmbeddingTaskResult,
  EmbeddingTaskInfo,
  EmbeddingProgress,
  // 向量检索
  EmbeddingVectorSearchParams,
  EmbeddingVectorSearchResult,
  // Channel 配置
  EmbeddingChannelInfo,
  EmbeddingChannelConfig,
  ChannelConfig,
  // 请求参数
  EmbeddingRequestParams,
  // 调度器与熔断配置
  SchedulerConfig,
  CircuitBreakerConfig,
  // API 契约
  EmbeddingAPI
} from '@shared/embedding.types'

// 默认配置（值）
export {
  DEFAULT_SCHEDULER_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  DEFAULT_CHANNEL_CONFIG
} from '@shared/embedding.types'

// 为了兼容性，也导出 ChannelStatus 作为 ChannelStatusType 的别名
export type { ChannelStatusType as ChannelStatus } from '@shared/embedding.types'

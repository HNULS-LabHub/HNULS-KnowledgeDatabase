/**
 * @file 嵌入服务共享类型定义
 * @description 跨进程（Main / Utility / Preload / Renderer）通用的嵌入任务契约
 */

// ============================================================================
// 任务状态类型
// ============================================================================

/** 文档任务状态 */
export type DocumentTaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'paused'
  | 'cancelled'

/** Chunk 任务状态 */
export type ChunkTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'retrying'

/** 嵌入任务状态（用户可见） */
export type EmbeddingTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused'

/** 通道状态类型 */
export type ChannelStatusType = 'active' | 'degraded' | 'blacklisted'

// ============================================================================
// Chunk 相关类型
// ============================================================================

/**
 * 单个 Chunk 输入数据
 */
export interface ChunkInput {
  /** chunk 在文档中的顺序索引 */
  index: number
  /** chunk 文本内容 */
  text: string
}

/**
 * 单个 Chunk 的嵌入结果
 */
export interface ChunkEmbeddingResult {
  /** chunk 索引 */
  index: number
  /** 生成的向量 */
  embedding: number[]
}

/**
 * Chunk 级任务（内部使用）
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
// 嵌入配置
// ============================================================================

/**
 * 嵌入配置
 */
export interface EmbeddingConfig {
  /** 配置 ID（来自 KnowledgeConfig.json 的 embedding.configs[].id） */
  id: string
  /** 模型 ID (e.g. text-embedding-3-large) */
  modelId: string
  /** 向量维度 */
  dimensions: number
  /** 可选: Provider ID */
  providerId?: string
}

// ============================================================================
// 文档级任务
// ============================================================================

/**
 * 文档级任务（内部使用）
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
// 嵌入任务提交与结果
// ============================================================================

/**
 * 提交嵌入任务的参数
 */
export interface SubmitEmbeddingTaskParams {
  /** 文档 ID */
  documentId: string
  /** 待嵌入的 chunks */
  chunks: ChunkInput[]
  /** 嵌入配置 */
  embeddingConfig: EmbeddingConfig
  /** 可选元数据 */
  meta?: {
    fileName?: string
    knowledgeBaseId?: string
  }
}

/**
 * 文档嵌入完成结果
 */
export interface EmbeddingTaskResult {
  /** 文档 ID */
  documentId: string
  /** 所有 chunk 的嵌入结果 */
  embeddings: ChunkEmbeddingResult[]
  /** 完成时间 */
  completedAt: number
}

/**
 * 嵌入任务信息（用户可见）
 */
export interface EmbeddingTaskInfo {
  /** 任务 ID (与 TaskMonitor 关联) */
  taskId: string
  /** 文档 ID */
  documentId: string
  /** 任务状态 */
  status: EmbeddingTaskStatus
  /** 进度百分比 */
  progress: number
  /** 已完成的 chunk 数 */
  completedChunks: number
  /** 总 chunk 数 */
  totalChunks: number
  /** 错误信息 (失败时) */
  error?: string
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
}

/**
 * 嵌入任务进度信息
 */
export interface EmbeddingProgress {
  /** 文档 ID */
  documentId: string
  /** 进度百分比 (0-100) */
  progress: number
  /** 已完成的 chunk 数 */
  completedChunks: number
  /** 总 chunk 数 */
  totalChunks: number
  /** 当前 RPM (可选) */
  currentRPM?: number
}

// ============================================================================
// 向量检索
// ============================================================================

/**
 * 向量检索参数
 */
export interface EmbeddingVectorSearchParams {
  /** 知识库 ID */
  knowledgeBaseId: number
  /** 查询向量 */
  queryVector: number[]
  /** 嵌入配置 ID */
  embeddingConfigId: string
  /** 向量维度 */
  dimensions: number
  /** 返回数量 */
  k?: number
  /** HNSW ef 参数 */
  ef?: number
}

/**
 * 向量检索结果
 */
export interface EmbeddingVectorSearchResult {
  /** chunk 记录 ID */
  id: string
  /** chunk 内容 */
  content: string
  /** chunk 索引 */
  chunk_index?: number
  /** 文件标识 */
  file_key?: string
  /** 文件名称 */
  file_name?: string
  /** 距离（越小越相似） */
  distance?: number
}

// ============================================================================
// Channel 配置
// ============================================================================

/**
 * 嵌入通道信息（用户可见）
 */
export interface EmbeddingChannelInfo {
  /** 通道 ID */
  id: string
  /** Provider ID */
  providerId: string
  /** Provider 名称 */
  providerName: string
  /** 优先级 (0 最高) */
  priority: number
  /** 状态 */
  status: ChannelStatusType
  /** 连续失败次数 */
  failureCount: number
}

/**
 * 嵌入通道配置（用于同步到后端）
 */
export interface EmbeddingChannelConfig {
  /** 通道 ID */
  id: string
  /** Provider ID */
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
}

/**
 * 单个通道配置（内部使用，完整版）
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
// 向量暂存表
// ============================================================================

/**
 * 向量暂存记录
 * 用于流式写入 system.vector_staging 表，字段扁平化以便直接写入 SurrealDB
 * 后台进程根据 embedding_config_id + dimensions 路由到目标向量表
 */
export interface VectorStagingRecord {
  // === 向量数据 ===
  /** 嵌入向量 */
  embedding: number[]

  // === 路由信息（指向目标表）===
  /** 嵌入配置 ID，用于生成目标表名 emb_cfg_{id}_{dimensions}_chunks */
  embedding_config_id: string
  /** 向量维度 */
  dimensions: number
  /** 目标 namespace */
  target_namespace: string
  /** 目标 database（知识库数据库名） */
  target_database: string

  // === Chunk 元数据 ===
  /** 文档 ID（用于关联 kb_document） */
  document_id: string
  /** Chunk 索引 */
  chunk_index: number
  /** Chunk 文本内容 */
  content: string
  /** 字符数 */
  char_count: number
  /** 起始字符位置 */
  start_char: number | null
  /** 结束字符位置 */
  end_char: number | null
  /** 文件标识（相对路径） */
  file_key: string
  /** 文件名 */
  file_name: string

  // === 处理状态 ===
  /** 是否已被搬运到目标表 */
  processed: boolean
  /** 开始处理时间戳（用于超时检测，防止重复处理） */
  processing_started_at?: number | null
  /** 创建时间戳 */
  created_at: number
}

// ============================================================================
// 调度器与熔断配置
// ============================================================================

/**
 * 调度器配置
 */
export interface SchedulerConfig {
  /** 最大并发数 */
  maxConcurrency: number
}

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

// ============================================================================
// Preload API 契约
// ============================================================================

/**
 * 嵌入服务 API
 */
export interface EmbeddingAPI {
  /**
   * 提交嵌入任务
   * @param params 任务参数
   * @returns 任务 ID
   */
  submitTask(params: SubmitEmbeddingTaskParams): Promise<string>

  /**
   * 暂停任务
   * @param documentId 文档 ID
   */
  pauseTask(documentId: string): Promise<void>

  /**
   * 恢复任务
   * @param documentId 文档 ID
   */
  resumeTask(documentId: string): Promise<void>

  /**
   * 取消任务
   * @param documentId 文档 ID
   */
  cancelTask(documentId: string): Promise<void>

  /**
   * 获取任务信息
   * @param documentId 文档 ID
   */
  getTaskInfo(documentId: string): Promise<EmbeddingTaskInfo | null>

  /**
   * 设置并发数
   * @param concurrency 并发数
   */
  setConcurrency(concurrency: number): Promise<void>

  /**
   * 获取通道列表
   */
  getChannels(): Promise<EmbeddingChannelInfo[]>

  /**
   * 更新通道配置
   * @param channels 通道配置列表
   */
  updateChannels(channels: EmbeddingChannelConfig[]): Promise<void>

  /**
   * 向量检索
   * @param params 检索参数
   */
  search(params: EmbeddingVectorSearchParams): Promise<EmbeddingVectorSearchResult[]>

  /**
   * 监听嵌入完成事件
   * @param callback 回调函数
   * @returns 取消监听函数
   */
  onEmbeddingCompleted(callback: (result: EmbeddingTaskResult) => void): () => void

  /**
   * 监听嵌入失败事件
   * @param callback 回调函数
   * @returns 取消监听函数
   */
  onEmbeddingFailed(callback: (error: { documentId: string; error: string }) => void): () => void
}

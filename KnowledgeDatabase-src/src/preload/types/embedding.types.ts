/**
 * @file 嵌入服务类型定义
 * @description 跨进程通用的嵌入任务契约
 */

// ============================================================================
// 嵌入任务提交参数
// ============================================================================

/**
 * 单个 Chunk 数据
 */
export interface ChunkInput {
  /** chunk 在文档中的顺序索引 */
  index: number
  /** chunk 文本内容 */
  text: string
}

/**
 * 嵌入配置
 */
export interface EmbeddingConfig {
  /** 模型 ID (e.g. text-embedding-3-large) */
  modelId: string
  /** 可选: 向量维度 */
  dimensions?: number
}

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

// ============================================================================
// 嵌入任务结果
// ============================================================================

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

// ============================================================================
// 嵌入任务进度
// ============================================================================

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
// 嵌入任务状态
// ============================================================================

export type EmbeddingTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused'

/**
 * 嵌入任务信息
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

// ============================================================================
// Channel 配置 (用户可见部分)
// ============================================================================

/**
 * 嵌入通道状态
 */
export type ChannelStatus = 'active' | 'degraded' | 'blacklisted'

/**
 * 嵌入通道信息 (用户可见)
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
  status: ChannelStatus
  /** 连续失败次数 */
  failureCount: number
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

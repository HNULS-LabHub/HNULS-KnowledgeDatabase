/**
 * 嵌入状态类型定义（renderer）
 */

export interface EmbeddingViewConfig {
  configId: string // 嵌入配置 ID（来自知识库配置）
  providerId: string // 提供商 ID
  modelId: string // 模型 ID
  dimensions?: number // 向量维度
}

export interface EmbeddingVector {
  id: string // 向量 ID
  content: string // 原始内容
  vector: number[] // 向量数据
  chunkId: string // 关联的分块 ID
}

export interface FileEmbeddingState {
  fileKey: string // 文件标识（路径或名称）
  config: EmbeddingViewConfig // 使用的配置
  vectors: EmbeddingVector[] // 向量列表
  status: 'idle' | 'running' | 'completed' | 'failed' // 状态
  progress?: number // 进度 0-100
  totalVectors?: number // 总向量数
  processedVectors?: number // 已处理向量数
  lastUpdated?: string // 最后更新时间
  error?: string // 错误信息
}

/**
 * @file Chunking 共享类型定义
 * @description 跨进程（Main / Utility / Preload / Renderer）通用的分块契约
 */

/**
 * 分块模式
 */
export type ChunkingMode = 'recursive' | 'semantic'

/**
 * Recursive：原有段落分块模式（无 overlap）
 */
export type RecursiveChunkingConfig = {
  /** 分块模式 */
  mode: 'recursive'
  /** 单个分段最大字符数 */
  maxChars: number
}

/**
 * Semantic：语义分块模式（段落优先，必要时降级到句子；支持 overlap）
 */
export type SemanticChunkingConfig = {
  /** 分块模式 */
  mode: 'semantic'
  /** 单个分段最大字符数 */
  maxChars: number
  /** 重叠字符数（仅 semantic 模式生效） */
  overlapChars: number
}

export type ChunkingConfig = RecursiveChunkingConfig | SemanticChunkingConfig

export interface Chunk {
  /** 分块 ID */
  id: string
  /** 分块索引（从 0 开始） */
  index: number
  /** 分块内容 */
  content: string
  /** 分块字符数 */
  size: number
  /** 在原文档中的起始字符位置 */
  startChar?: number
  /** 在原文档中的结束字符位置 */
  endChar?: number
  /** 元数据（可选） */
  metadata?: Record<string, unknown>
}

export interface ChunkingResult {
  /** 文件标识（相对路径） */
  fileKey: string
  /** 分块配置 */
  config: ChunkingConfig
  /** 分块列表 */
  chunks: Chunk[]
  /** 文档总字符数 */
  totalChars: number
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
}

export interface ChunkingRequest {
  /** 知识库 ID */
  knowledgeBaseId: number
  /** 文件相对路径 */
  fileRelativePath: string
  /** 分块配置 */
  config: ChunkingConfig
  /** 解析版本 ID（非纯文本文件需要） */
  parsingVersionId?: string
}

export interface GetChunkingResultRequest {
  /** 知识库 ID */
  knowledgeBaseId: number
  /** 文件相对路径 */
  fileRelativePath: string
  /** 分块配置 */
  config: ChunkingConfig
}

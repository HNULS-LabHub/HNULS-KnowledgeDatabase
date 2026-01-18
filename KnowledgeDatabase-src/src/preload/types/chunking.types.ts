/**
 * 分块服务类型定义（Preload）
 */
import type { APIResponse } from './index'

/**
 * 分块配置
 */
export interface ChunkingConfig {
  /** 分块模式 */
  mode: 'recursive'
  /** 单个分段最大字符数 */
  maxChars: number
}

/**
 * 单个分块
 */
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
  startChar: number
  /** 在原文档中的结束字符位置 */
  endChar: number
  /** 元数据（可选） */
  metadata?: {
    paragraphIndex?: number
    sentenceIndex?: number
  }
}

/**
 * 分块结果
 */
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

/**
 * 分块请求
 */
export interface ChunkingRequest {
  /** 知识库 ID */
  knowledgeBaseId: number
  /** 文件相对路径 */
  fileRelativePath: string
  /** 分块配置 */
  config: ChunkingConfig
  /** 解析版本 ID（对于非纯文本文件，需要指定解析版本） */
  parsingVersionId?: string
}

/**
 * 获取分块结果请求
 */
export interface GetChunkingResultRequest {
  /** 知识库 ID */
  knowledgeBaseId: number
  /** 文件相对路径 */
  fileRelativePath: string
  /** 分块配置 */
  config: ChunkingConfig
}

/**
 * 分块 API 接口
 */
export interface ChunkingAPI {
  /**
   * 执行分块
   *
   * IPC 调用范例：
   * ```typescript
   * const result = await chunkingAPI.chunkDocument({
   *   knowledgeBaseId: 1,
   *   fileRelativePath: 'documents/example.pdf',
   *   config: {
   *     mode: 'recursive',
   *     maxChars: 1000
   *   },
   *   parsingVersionId: 'version-1' // 非纯文本文件需要指定
   * })
   *
   * if (result.success && result.data) {
   *   console.log('分块成功，共', result.data.chunks.length, '个分块')
   * } else {
   *   console.error('分块失败:', result.error)
   * }
   * ```
   */
  chunkDocument: (req: ChunkingRequest) => Promise<APIResponse<ChunkingResult>>

  /**
   * 获取分块结果
   *
   * IPC 调用范例：
   * ```typescript
   * const result = await chunkingAPI.getChunkingResult({
   *   knowledgeBaseId: 1,
   *   fileRelativePath: 'documents/example.pdf',
   *   config: {
   *     mode: 'recursive',
   *     maxChars: 1000
   *   }
   * })
   *
   * if (result.success && result.data) {
   *   console.log('获取到', result.data.chunks.length, '个分块')
   * }
   * ```
   */
  getChunkingResult: (req: GetChunkingResultRequest) => Promise<APIResponse<ChunkingResult | null>>
}

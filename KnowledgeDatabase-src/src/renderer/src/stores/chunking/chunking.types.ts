/**
 * 分块状态类型定义
 */

/**
 * 分块配置
 */
export interface ChunkingConfig {
  /** 分块模式 - 固定为段落分块模式 */
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
  /** 分块内容 */
  content: string
  /** 分块字符数 */
  size: number
  /** 分块索引（从 0 开始） */
  index: number
}

/**
 * 文件分块状态
 */
export interface FileChunkingState {
  /** 文件标识（路径或名称） */
  fileKey: string
  /** 分块配置 */
  config: ChunkingConfig
  /** 分块列表 */
  chunks: Chunk[]
  /** 最后更新时间 */
  lastUpdated?: string
}

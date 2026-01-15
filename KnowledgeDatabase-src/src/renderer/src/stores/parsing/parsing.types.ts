/**
 * 解析阶段的枚举
 */
export type ParsingStage = 'parsing' | 'chunking' | 'embedding' | 'kg-indexing'

/**
 * 每个阶段的状态
 */
export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export type ParsingVersionStatus = 'running' | 'completed' | 'failed'

export interface ParsingStageProgress {
  stage: ParsingStage
  status: StageStatus
  progress: number // 0-100
  details?: string
  error?: string
}

/**
 * 单个解析版本的信息
 */
export interface ParsingVersion {
  id: string
  createdAt: number
  parserName: string
  status: ParsingVersionStatus
  stages: Record<ParsingStage, ParsingStageProgress>
  summary?: {
    chunkCount?: number
    tokenCount?: number
    parseTimeMs?: number
    embeddingModel?: string
  }
}

/**
 * 单个文件的完整解析状态
 */
export interface FileParsingState {
  fileKey: string // 通常用 path 作为 key
  activeVersionId: string | null
  versions: ParsingVersion[]
}

export interface StartParsingOptions {
  parserName: string
}

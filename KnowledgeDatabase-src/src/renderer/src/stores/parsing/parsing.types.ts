/**
 * 解析状态（按原型设计1.html重写）
 */
export type ParsingStatus = 'active' | 'archived'

export interface ParsingVersion {
  id: string
  name: string
  timestamp: string
  status: ParsingStatus
}

export interface FileParsingState {
  fileKey: string
  activeVersionId: string | null
  versions: ParsingVersion[]
}

export interface StartParsingOptions {
  parserName: string
}

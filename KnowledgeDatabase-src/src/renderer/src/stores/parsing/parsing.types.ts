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
  progress?: number
}

export interface StartParsingOptions {
  parserName: string
  knowledgeBaseId: number
  /** 前端预生成的监控任务 ID，用于前后端跟踪同一任务 */
  monitorTaskId?: string
}

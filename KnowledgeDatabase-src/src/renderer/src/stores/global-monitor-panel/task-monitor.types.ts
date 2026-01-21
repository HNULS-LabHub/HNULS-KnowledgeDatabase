/**
 * 任务监控相关类型定义
 */

/**
 * 任务状态枚举
 */
export type TaskStatus = 'running' | 'completed' | 'failed' | 'queued' | 'paused'

/**
 * 任务类型
 */
export type TaskType =
  | 'ETL Sync'
  | 'Report'
  | 'Processing'
  | 'Analytics'
  | 'Backup'
  | 'Cache'
  | 'Archiving'
  | 'Marketing'
  | 'Security'
  | 'File Import' // 文件导入任务

/**
 * 文件导入进度详情
 */
export interface FileImportProgress {
  percentage: number
  processed: number
  totalFiles: number
  imported: number
  failed: number
  currentFile: string
}

/**
 * 任务数据结构
 */
export interface Task {
  id: string
  name: string
  type: TaskType
  status: TaskStatus
  progress: number
  owner: string
  started: string

  // 文件导入专用字段（可选）
  knowledgeBaseName?: string // 知识库名称（运行时获取，不持久化）
  knowledgeBaseId?: number // 知识库 ID
  importDetail?: FileImportProgress // 导入详情
}

/**
 * 筛选条件
 */
export interface TaskFilter {
  searchQuery: string
  statusFilter: TaskStatus | 'All Status'
  typeFilter: TaskType | 'All Types'
}

/**
 * Store 状态
 */
export interface TaskMonitorState {
  tasks: Task[]
  filter: TaskFilter
  selectedTaskIds: Set<string>
  loading: boolean
  error: string | null
}

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

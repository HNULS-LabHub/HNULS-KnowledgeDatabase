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
  | 'Document Parsing' // 文档解析任务
  | 'Chunking' // 分块任务

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
 * 文档解析进度详情
 */
export interface DocumentParsingProgress {
  percentage: number
  state: string // MinerU 任务状态
  extractedPages?: number
  totalPages?: number
  currentDetail?: string // 当前处理详情（如 "5/10 页"）
  versionId: string
  batchId: string
}

/**
 * 分块进度详情
 */
export interface ChunkingProgress {
  percentage: number
  totalChunks: number
  currentDetail?: string // 当前处理详情（如 "生成了 50 个分块"）
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

  // 文档解析专用字段（可选）
  parsingDetail?: DocumentParsingProgress // 解析详情
  fileKey?: string // 文件标识（用于匹配进度事件）
  fileName?: string // 文件名

  // 分块专用字段（可选）
  chunkingDetail?: ChunkingProgress // 分块详情
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

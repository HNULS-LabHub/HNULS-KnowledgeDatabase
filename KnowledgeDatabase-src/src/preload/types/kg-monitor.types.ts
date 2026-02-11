/**
 * @file 知识图谱监控类型定义
 * @description 定义知识图谱任务监控相关的 Preload API 类型
 */

// ============================================================================
// 状态枚举
// ============================================================================

export type KgTaskStatus = 'pending' | 'progressing' | 'completed' | 'failed'
export type KgChunkStatus = 'pending' | 'progressing' | 'completed' | 'failed'

// ============================================================================
// 记录结构（跨进程传输，扁平数据）
// ============================================================================

export interface KgTaskRecord {
  taskId: string
  fileKey: string
  status: KgTaskStatus
  chunksTotal: number
  chunksCompleted: number
  chunksFailed: number
  createdAt: number
  updatedAt: number
  error?: string
  sourceNamespace?: string
  sourceDatabase?: string
  sourceTable?: string
}

export interface KgChunkRecord {
  taskId: string
  chunkIndex: number
  status: KgChunkStatus
  error?: string
  createdAt: number
  updatedAt: number
}

// ============================================================================
// 查询参数
// ============================================================================

export interface KgTaskQueryParams {
  page?: number
  pageSize?: number
  status?: KgTaskStatus | 'all'
  fileKey?: string
  sortBy?: 'updatedAt' | 'createdAt' | 'fileKey' | 'status'
  sortDir?: 'asc' | 'desc'
}

export interface KgChunkQueryParams {
  taskId: string
  page?: number
  pageSize?: number
}

export interface KgTaskQueryResult {
  items: KgTaskRecord[]
  total: number
}

export interface KgChunkQueryResult {
  items: KgChunkRecord[]
  total: number
}

// ============================================================================
// Preload API 契约
// ============================================================================

export interface KgMonitorAPI {
  getTasks(params: KgTaskQueryParams): Promise<KgTaskQueryResult>
  getTaskChunks(params: KgChunkQueryParams): Promise<KgChunkQueryResult>
  cancelTask(taskId: string): Promise<boolean>
  retryTask(taskId: string): Promise<boolean>
  removeTask(taskId: string): Promise<boolean>
}

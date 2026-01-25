/**
 * @file 全局任务监控类型定义
 * @description 跨进程通用任务记录与 API 契约
 */

// ============================================================================
// 任务状态枚举
// ============================================================================

export type TaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed'

// ============================================================================
// 任务记录（跨进程传输的扁平结构）
// ============================================================================

export interface TaskRecord {
  id: string
  type: string // 业务自定义，如 'file-import' | 'document-parsing' | 'chunking' | 'embedding' | ...
  title: string
  status: TaskStatus
  progress: number // 0-100
  meta: Record<string, unknown> // 扁平对象，业务自定义元数据
  createdAt: number
  updatedAt: number
  error?: string
}

// ============================================================================
// 任务句柄（业务模块用于更新任务进度）
// ============================================================================

export interface TaskHandle {
  taskId: string
  updateProgress(progress: number, metaPatch?: Record<string, unknown>): void
  complete(metaPatch?: Record<string, unknown>): void
  fail(error: string): void
  pause(): void
  resume(): void
}

// ============================================================================
// 创建任务参数
// ============================================================================

export interface CreateTaskParams {
  type: string
  title: string
  meta?: Record<string, unknown>
}

// ============================================================================
// Preload API 契约
// ============================================================================

export interface TaskMonitorAPI {
  createTask(params: CreateTaskParams): Promise<TaskHandle>
  getTasks(): Promise<TaskRecord[]>
  onTaskChanged(callback: (tasks: TaskRecord[]) => void): () => void
  removeTask(taskId: string): Promise<void>
  clearTasks(filter?: { status?: TaskStatus[] }): Promise<number>
  batchPause(taskIds: string[]): Promise<void>
  batchResume(taskIds: string[]): Promise<void>
}

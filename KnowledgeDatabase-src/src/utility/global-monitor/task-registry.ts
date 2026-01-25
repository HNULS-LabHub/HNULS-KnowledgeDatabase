/**
 * @file 任务注册表
 * @description 内存中的任务状态管理，运行在 Utility Process 中
 */

import type {
  TaskRecord,
  TaskStatus,
  CreateTaskParams
} from '../../preload/types/task-monitor.types'

export class TaskRegistry {
  private tasks: Map<string, TaskRecord> = new Map()
  private listeners: Set<(tasks: TaskRecord[]) => void> = new Set()

  // ============================================================================
  // 创建任务
  // ============================================================================

  create(params: CreateTaskParams): string {
    const id = this.generateId()
    const now = Date.now()

    const task: TaskRecord = {
      id,
      type: params.type,
      title: params.title,
      status: 'pending',
      progress: 0,
      meta: params.meta ?? {},
      createdAt: now,
      updatedAt: now
    }

    this.tasks.set(id, task)
    this.notifyChange()
    return id
  }

  // ============================================================================
  // 更新任务
  // ============================================================================

  updateProgress(taskId: string, progress: number, metaPatch?: Record<string, unknown>): boolean {
    const task = this.tasks.get(taskId)
    if (!task) return false

    task.status = 'running'
    task.progress = Math.min(100, Math.max(0, progress))
    task.updatedAt = Date.now()

    if (metaPatch) {
      task.meta = { ...task.meta, ...metaPatch }
    }

    this.notifyChange()
    return true
  }

  complete(taskId: string, metaPatch?: Record<string, unknown>): boolean {
    const task = this.tasks.get(taskId)
    if (!task) return false

    task.status = 'completed'
    task.progress = 100
    task.updatedAt = Date.now()

    if (metaPatch) {
      task.meta = { ...task.meta, ...metaPatch }
    }

    this.notifyChange()
    return true
  }

  fail(taskId: string, error: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task) return false

    task.status = 'failed'
    task.error = error
    task.updatedAt = Date.now()

    this.notifyChange()
    return true
  }

  pause(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task || task.status !== 'running') return false

    task.status = 'paused'
    task.updatedAt = Date.now()

    this.notifyChange()
    return true
  }

  resume(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task || task.status !== 'paused') return false

    task.status = 'running'
    task.updatedAt = Date.now()

    this.notifyChange()
    return true
  }

  // ============================================================================
  // 删除任务
  // ============================================================================

  remove(taskId: string): boolean {
    const deleted = this.tasks.delete(taskId)
    if (deleted) {
      this.notifyChange()
    }
    return deleted
  }

  clear(filter?: { status?: TaskStatus[] }): number {
    let count = 0

    if (!filter?.status || filter.status.length === 0) {
      count = this.tasks.size
      this.tasks.clear()
    } else {
      const statusSet = new Set(filter.status)
      for (const [id, task] of this.tasks) {
        if (statusSet.has(task.status)) {
          this.tasks.delete(id)
          count++
        }
      }
    }

    if (count > 0) {
      this.notifyChange()
    }
    return count
  }

  // ============================================================================
  // 批量操作
  // ============================================================================

  batchPause(taskIds: string[]): void {
    let changed = false
    for (const id of taskIds) {
      const task = this.tasks.get(id)
      if (task && task.status === 'running') {
        task.status = 'paused'
        task.updatedAt = Date.now()
        changed = true
      }
    }
    if (changed) {
      this.notifyChange()
    }
  }

  batchResume(taskIds: string[]): void {
    let changed = false
    for (const id of taskIds) {
      const task = this.tasks.get(id)
      if (task && task.status === 'paused') {
        task.status = 'running'
        task.updatedAt = Date.now()
        changed = true
      }
    }
    if (changed) {
      this.notifyChange()
    }
  }

  // ============================================================================
  // 查询
  // ============================================================================

  getAll(): TaskRecord[] {
    return Array.from(this.tasks.values())
  }

  get(taskId: string): TaskRecord | undefined {
    return this.tasks.get(taskId)
  }

  // ============================================================================
  // 订阅
  // ============================================================================

  subscribe(listener: (tasks: TaskRecord[]) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyChange(): void {
    const tasks = this.getAll()
    for (const listener of this.listeners) {
      try {
        listener(tasks)
      } catch (err) {
        console.error('[TaskRegistry] Listener error:', err)
      }
    }
  }

  // ============================================================================
  // 工具
  // ============================================================================

  private generateId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }
}

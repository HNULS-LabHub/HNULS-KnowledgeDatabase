/**
 * @file 全局任务监控 Preload API
 * @description 提供任务监控相关的 IPC 通信接口
 */

import { ipcRenderer } from 'electron'
import type {
  TaskMonitorAPI,
  TaskHandle,
  TaskRecord,
  TaskStatus,
  CreateTaskParams
} from '../types/task-monitor.types'

// ============================================================================
// IPC Channel 常量
// ============================================================================

const IPC_CHANNELS = {
  CREATE_TASK: 'task-monitor:create',
  GET_TASKS: 'task-monitor:getall',
  TASK_CHANGED: 'task-monitor:changed',
  REMOVE_TASK: 'task-monitor:remove',
  CLEAR_TASKS: 'task-monitor:clear',
  UPDATE_PROGRESS: 'task-monitor:updateprogress',
  COMPLETE_TASK: 'task-monitor:complete',
  FAIL_TASK: 'task-monitor:fail',
  PAUSE_TASK: 'task-monitor:pause',
  RESUME_TASK: 'task-monitor:resume',
  BATCH_PAUSE: 'task-monitor:batchpause',
  BATCH_RESUME: 'task-monitor:batchresume'
} as const

// ============================================================================
// TaskHandle 工厂函数
// ============================================================================

function createTaskHandle(taskId: string): TaskHandle {
  return {
    taskId,
    updateProgress(progress: number, metaPatch?: Record<string, unknown>): void {
      ipcRenderer.send(IPC_CHANNELS.UPDATE_PROGRESS, { taskId, progress, metaPatch })
    },
    complete(metaPatch?: Record<string, unknown>): void {
      ipcRenderer.send(IPC_CHANNELS.COMPLETE_TASK, { taskId, metaPatch })
    },
    fail(error: string): void {
      ipcRenderer.send(IPC_CHANNELS.FAIL_TASK, { taskId, error })
    },
    pause(): void {
      ipcRenderer.send(IPC_CHANNELS.PAUSE_TASK, { taskId })
    },
    resume(): void {
      ipcRenderer.send(IPC_CHANNELS.RESUME_TASK, { taskId })
    }
  }
}

// ============================================================================
// API 实现
// ============================================================================

export const taskMonitorAPI: TaskMonitorAPI = {
  async createTask(params: CreateTaskParams): Promise<TaskHandle> {
    const taskId = await ipcRenderer.invoke(IPC_CHANNELS.CREATE_TASK, params)
    return createTaskHandle(taskId)
  },

  async getTasks(): Promise<TaskRecord[]> {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_TASKS)
  },

  onTaskChanged(callback: (tasks: TaskRecord[]) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, tasks: TaskRecord[]): void => {
      callback(tasks)
    }
    ipcRenderer.on(IPC_CHANNELS.TASK_CHANGED, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.TASK_CHANGED, handler)
    }
  },

  async removeTask(taskId: string): Promise<void> {
    return ipcRenderer.invoke(IPC_CHANNELS.REMOVE_TASK, taskId)
  },

  async clearTasks(filter?: { status?: TaskStatus[] }): Promise<number> {
    return ipcRenderer.invoke(IPC_CHANNELS.CLEAR_TASKS, filter)
  },

  async batchPause(taskIds: string[]): Promise<void> {
    return ipcRenderer.invoke(IPC_CHANNELS.BATCH_PAUSE, taskIds)
  },

  async batchResume(taskIds: string[]): Promise<void> {
    return ipcRenderer.invoke(IPC_CHANNELS.BATCH_RESUME, taskIds)
  }
}

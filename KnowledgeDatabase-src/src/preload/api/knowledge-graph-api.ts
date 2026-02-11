/**
 * @file 知识图谱 Preload API
 * @description 提供知识图谱构建相关的 IPC 通信接口
 */

import { ipcRenderer } from 'electron'
import type { KnowledgeGraphAPI } from '../types/knowledge-graph.types'
import type { KGSubmitTaskParams, KGTaskStatus } from '../types/knowledge-graph.types'

const CH = {
  SUBMIT_TASK: 'knowledge-graph:submit-task',
  QUERY_STATUS: 'knowledge-graph:query-status',
  UPDATE_CONCURRENCY: 'knowledge-graph:update-concurrency',
  // 事件（main → renderer）
  TASK_PROGRESS: 'knowledge-graph:task-progress',
  TASK_COMPLETED: 'knowledge-graph:task-completed',
  TASK_FAILED: 'knowledge-graph:task-failed'
} as const

export const knowledgeGraphAPI: KnowledgeGraphAPI = {
  async submitTask(params: KGSubmitTaskParams): Promise<{ taskId: string; chunksTotal: number }> {
    return ipcRenderer.invoke(CH.SUBMIT_TASK, params)
  },

  async queryStatus(): Promise<KGTaskStatus[]> {
    return ipcRenderer.invoke(CH.QUERY_STATUS)
  },

  async updateConcurrency(maxConcurrency: number): Promise<void> {
    return ipcRenderer.invoke(CH.UPDATE_CONCURRENCY, maxConcurrency)
  },

  onTaskProgress(callback) {
    const handler = (_e: any, taskId: string, completed: number, failed: number, total: number) => {
      callback(taskId, completed, failed, total)
    }
    ipcRenderer.on(CH.TASK_PROGRESS, handler)
    return () => ipcRenderer.removeListener(CH.TASK_PROGRESS, handler)
  },

  onTaskCompleted(callback) {
    const handler = (_e: any, taskId: string) => callback(taskId)
    ipcRenderer.on(CH.TASK_COMPLETED, handler)
    return () => ipcRenderer.removeListener(CH.TASK_COMPLETED, handler)
  },

  onTaskFailed(callback) {
    const handler = (_e: any, taskId: string, error: string) => callback(taskId, error)
    ipcRenderer.on(CH.TASK_FAILED, handler)
    return () => ipcRenderer.removeListener(CH.TASK_FAILED, handler)
  }
}

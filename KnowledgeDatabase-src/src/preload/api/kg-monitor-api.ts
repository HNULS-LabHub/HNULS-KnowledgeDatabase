/**
 * @file 知识图谱监控 Preload API
 * @description 提供知识图谱任务监控相关的 IPC 通信接口
 */

import { ipcRenderer } from 'electron'
import type {
  KgMonitorAPI,
  KgTaskQueryParams,
  KgTaskQueryResult,
  KgChunkQueryParams,
  KgChunkQueryResult
} from '../types/kg-monitor.types'

// ============================================================================
// IPC Channel 常量
// ============================================================================

const IPC_CHANNELS = {
  GET_TASKS: 'kg-monitor:gettasks',
  GET_CHUNKS: 'kg-monitor:getchunks',
  CANCEL_TASK: 'kg-monitor:cancel',
  RETRY_TASK: 'kg-monitor:retry',
  REMOVE_TASK: 'kg-monitor:remove'
} as const

// ============================================================================
// API 实现
// ============================================================================

export const kgMonitorAPI: KgMonitorAPI = {
  async getTasks(params: KgTaskQueryParams): Promise<KgTaskQueryResult> {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_TASKS, params)
  },

  async getTaskChunks(params: KgChunkQueryParams): Promise<KgChunkQueryResult> {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_CHUNKS, params)
  },

  async cancelTask(taskId: string): Promise<boolean> {
    return ipcRenderer.invoke(IPC_CHANNELS.CANCEL_TASK, taskId)
  },

  async retryTask(taskId: string): Promise<boolean> {
    return ipcRenderer.invoke(IPC_CHANNELS.RETRY_TASK, taskId)
  },

  async removeTask(taskId: string): Promise<boolean> {
    return ipcRenderer.invoke(IPC_CHANNELS.REMOVE_TASK, taskId)
  }
}

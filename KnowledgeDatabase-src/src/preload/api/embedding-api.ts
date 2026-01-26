/**
 * @file 嵌入服务 Preload API
 * @description 提供嵌入相关的 IPC 通信接口
 */

import { ipcRenderer } from 'electron'
import type {
  EmbeddingAPI,
  SubmitEmbeddingTaskParams,
  EmbeddingTaskInfo,
  EmbeddingTaskResult,
  EmbeddingChannelInfo
} from '../types/embedding.types'

// ============================================================================
// IPC Channel 常量
// ============================================================================

const IPC_CHANNELS = {
  SUBMIT_TASK: 'embedding:submit',
  PAUSE_TASK: 'embedding:pause',
  RESUME_TASK: 'embedding:resume',
  CANCEL_TASK: 'embedding:cancel',
  GET_TASK_INFO: 'embedding:get-task-info',
  SET_CONCURRENCY: 'embedding:set-concurrency',
  GET_CHANNELS: 'embedding:get-channels',

  // 事件通道
  EMBEDDING_COMPLETED: 'embedding:completed',
  EMBEDDING_FAILED: 'embedding:failed',
  EMBEDDING_PROGRESS: 'embedding:progress'
} as const

// ============================================================================
// API 实现
// ============================================================================

export const embeddingAPI: EmbeddingAPI = {
  async submitTask(params: SubmitEmbeddingTaskParams): Promise<string> {
    return ipcRenderer.invoke(IPC_CHANNELS.SUBMIT_TASK, params)
  },

  async pauseTask(documentId: string): Promise<void> {
    return ipcRenderer.invoke(IPC_CHANNELS.PAUSE_TASK, documentId)
  },

  async resumeTask(documentId: string): Promise<void> {
    return ipcRenderer.invoke(IPC_CHANNELS.RESUME_TASK, documentId)
  },

  async cancelTask(documentId: string): Promise<void> {
    return ipcRenderer.invoke(IPC_CHANNELS.CANCEL_TASK, documentId)
  },

  async getTaskInfo(documentId: string): Promise<EmbeddingTaskInfo | null> {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_TASK_INFO, documentId)
  },

  async setConcurrency(concurrency: number): Promise<void> {
    return ipcRenderer.invoke(IPC_CHANNELS.SET_CONCURRENCY, concurrency)
  },

  async getChannels(): Promise<EmbeddingChannelInfo[]> {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_CHANNELS)
  },

  onEmbeddingCompleted(callback: (result: EmbeddingTaskResult) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, result: EmbeddingTaskResult): void => {
      callback(result)
    }
    ipcRenderer.on(IPC_CHANNELS.EMBEDDING_COMPLETED, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.EMBEDDING_COMPLETED, handler)
    }
  },

  onEmbeddingFailed(callback: (error: { documentId: string; error: string }) => void): () => void {
    const handler = (
      _event: Electron.IpcRendererEvent,
      error: { documentId: string; error: string }
    ): void => {
      callback(error)
    }
    ipcRenderer.on(IPC_CHANNELS.EMBEDDING_FAILED, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.EMBEDDING_FAILED, handler)
    }
  }
}

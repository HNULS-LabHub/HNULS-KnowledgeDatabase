/**
 * @file 嵌入服务 IPC 处理器
 * @description 处理渲染进程发送的嵌入相关请求
 */

import { ipcMain } from 'electron'
import { embeddingEngineBridge } from '../services/embedding-engine-bridge'
import type {
  SubmitEmbeddingTaskParams,
  EmbeddingVectorSearchParams
} from '../../preload/types/embedding.types'

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
  SEARCH: 'embedding:search'
} as const

// ============================================================================
// EmbeddingIPCHandler
// ============================================================================

export class EmbeddingIPCHandler {
  constructor() {
    this.registerHandlers()
  }

  private registerHandlers(): void {
    // 提交嵌入任务
    ipcMain.handle(IPC_CHANNELS.SUBMIT_TASK, async (_event, params: SubmitEmbeddingTaskParams) => {
      return embeddingEngineBridge.submitTask(params)
    })

    // 暂停任务
    ipcMain.handle(IPC_CHANNELS.PAUSE_TASK, async (_event, documentId: string) => {
      embeddingEngineBridge.pauseTask(documentId)
    })

    // 恢复任务
    ipcMain.handle(IPC_CHANNELS.RESUME_TASK, async (_event, documentId: string) => {
      embeddingEngineBridge.resumeTask(documentId)
    })

    // 取消任务
    ipcMain.handle(IPC_CHANNELS.CANCEL_TASK, async (_event, documentId: string) => {
      embeddingEngineBridge.cancelTask(documentId)
    })

    // 获取任务信息
    ipcMain.handle(IPC_CHANNELS.GET_TASK_INFO, async (_event, documentId: string) => {
      return embeddingEngineBridge.getTaskInfo(documentId)
    })

    // 设置并发数
    ipcMain.handle(IPC_CHANNELS.SET_CONCURRENCY, async (_event, concurrency: number) => {
      embeddingEngineBridge.setConcurrency(concurrency)
    })

    // 获取通道列表
    ipcMain.handle(IPC_CHANNELS.GET_CHANNELS, async () => {
      return embeddingEngineBridge.getChannels()
    })

    // 向量检索
    ipcMain.handle(IPC_CHANNELS.SEARCH, async (_event, params: EmbeddingVectorSearchParams) => {
      return embeddingEngineBridge.search(params)
    })

    console.log('[EmbeddingIPCHandler] Registered embedding IPC handlers')
  }
}

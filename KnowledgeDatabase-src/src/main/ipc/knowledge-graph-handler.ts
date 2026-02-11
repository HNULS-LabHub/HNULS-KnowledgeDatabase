/**
 * @file 知识图谱 IPC Handler
 * @description 处理渲染进程对知识图谱构建的请求，转发到 KnowledgeGraphBridge
 */

import { ipcMain, BrowserWindow } from 'electron'
import { knowledgeGraphBridge } from '../services/knowledge-graph-bridge'
import { logger } from '../services/logger'
import type { KGSubmitTaskParams } from '@shared/knowledge-graph-ipc.types'

const CH = {
  SUBMIT_TASK: 'knowledge-graph:submit-task',
  QUERY_STATUS: 'knowledge-graph:query-status',
  UPDATE_CONCURRENCY: 'knowledge-graph:update-concurrency',
  TASK_PROGRESS: 'knowledge-graph:task-progress',
  TASK_COMPLETED: 'knowledge-graph:task-completed',
  TASK_FAILED: 'knowledge-graph:task-failed'
} as const

/** 向所有渲染窗口广播事件 */
function broadcast(channel: string, ...args: any[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, ...args)
  }
}

let unsubProgress: (() => void) | null = null
let unsubCompleted: (() => void) | null = null
let unsubFailed: (() => void) | null = null

export function registerKnowledgeGraphHandlers(): void {
  ipcMain.handle(CH.SUBMIT_TASK, async (_event, params: KGSubmitTaskParams) => {
    logger.info('[KG-IPCHandler] submitTask received params:', params)
    try {
      return await knowledgeGraphBridge.submitTask(params)
    } catch (error) {
      logger.error('[KG-IPCHandler] submitTask failed:', error)
      throw error
    }
  })

  ipcMain.handle(CH.QUERY_STATUS, async () => {
    try {
      return await knowledgeGraphBridge.queryStatus()
    } catch (error) {
      logger.error('[KG-IPCHandler] queryStatus failed:', error)
      return []
    }
  })

  ipcMain.handle(CH.UPDATE_CONCURRENCY, async (_event, maxConcurrency: number) => {
    knowledgeGraphBridge.updateConcurrency(maxConcurrency)
  })

  // 订阅 bridge 事件，广播到渲染进程
  unsubProgress = knowledgeGraphBridge.onTaskProgress((taskId, completed, failed, total) => {
    broadcast(CH.TASK_PROGRESS, taskId, completed, failed, total)
  })

  unsubCompleted = knowledgeGraphBridge.onTaskCompleted((taskId) => {
    broadcast(CH.TASK_COMPLETED, taskId)
  })

  unsubFailed = knowledgeGraphBridge.onTaskFailed((taskId, error) => {
    broadcast(CH.TASK_FAILED, taskId, error)
  })

  logger.info('[KG-IPCHandler] Handlers registered')
}

export function unregisterKnowledgeGraphHandlers(): void {
  ipcMain.removeHandler(CH.SUBMIT_TASK)
  ipcMain.removeHandler(CH.QUERY_STATUS)
  ipcMain.removeHandler(CH.UPDATE_CONCURRENCY)
  unsubProgress?.()
  unsubCompleted?.()
  unsubFailed?.()
  logger.info('[KG-IPCHandler] Handlers unregistered')
}

/**
 * @file 知识图谱 IPC Handler
 * @description 处理渲染进程对知识图谱构建的请求，转发到 KnowledgeGraphBridge
 */

import { ipcMain, BrowserWindow } from 'electron'
import { knowledgeGraphBridge } from '../services/knowledge-graph-bridge'
import { logger } from '../services/logger'
import type { KGSubmitTaskParams, KGCreateSchemaParams } from '@shared/knowledge-graph-ipc.types'

const CH = {
  SUBMIT_TASK: 'knowledge-graph:submit-task',
  QUERY_STATUS: 'knowledge-graph:query-status',
  UPDATE_CONCURRENCY: 'knowledge-graph:update-concurrency',
  CREATE_GRAPH_SCHEMA: 'knowledge-graph:create-graph-schema',
  QUERY_BUILD_STATUS: 'knowledge-graph:query-build-status',
  TASK_PROGRESS: 'knowledge-graph:task-progress',
  TASK_COMPLETED: 'knowledge-graph:task-completed',
  TASK_FAILED: 'knowledge-graph:task-failed',
  BUILD_PROGRESS: 'knowledge-graph:build-progress',
  BUILD_COMPLETED: 'knowledge-graph:build-completed',
  BUILD_FAILED: 'knowledge-graph:build-failed'
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
let unsubBuildProgress: (() => void) | null = null
let unsubBuildCompleted: (() => void) | null = null
let unsubBuildFailed: (() => void) | null = null

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

  ipcMain.handle(CH.CREATE_GRAPH_SCHEMA, async (_event, params: KGCreateSchemaParams) => {
    logger.info('[KG-IPCHandler] createGraphSchema received:', params)
    try {
      return await knowledgeGraphBridge.createGraphSchema(params)
    } catch (error) {
      logger.error('[KG-IPCHandler] createGraphSchema failed:', error)
      throw error
    }
  })

  ipcMain.handle(CH.QUERY_BUILD_STATUS, async () => {
    try {
      return await knowledgeGraphBridge.queryBuildStatus()
    } catch (error) {
      logger.error('[KG-IPCHandler] queryBuildStatus failed:', error)
      return []
    }
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

  unsubBuildProgress = knowledgeGraphBridge.onBuildProgress(
    (taskId, completed, failed, total, entitiesTotal, relationsTotal) => {
      broadcast(CH.BUILD_PROGRESS, taskId, completed, failed, total, entitiesTotal, relationsTotal)
    }
  )

  unsubBuildCompleted = knowledgeGraphBridge.onBuildCompleted((taskId) => {
    broadcast(CH.BUILD_COMPLETED, taskId)
  })

  unsubBuildFailed = knowledgeGraphBridge.onBuildFailed((taskId, error) => {
    broadcast(CH.BUILD_FAILED, taskId, error)
  })

  logger.info('[KG-IPCHandler] Handlers registered')
}

export function unregisterKnowledgeGraphHandlers(): void {
  ipcMain.removeHandler(CH.SUBMIT_TASK)
  ipcMain.removeHandler(CH.QUERY_STATUS)
  ipcMain.removeHandler(CH.UPDATE_CONCURRENCY)
  ipcMain.removeHandler(CH.CREATE_GRAPH_SCHEMA)
  ipcMain.removeHandler(CH.QUERY_BUILD_STATUS)
  unsubProgress?.()
  unsubCompleted?.()
  unsubFailed?.()
  unsubBuildProgress?.()
  unsubBuildCompleted?.()
  unsubBuildFailed?.()
  logger.info('[KG-IPCHandler] Handlers unregistered')
}

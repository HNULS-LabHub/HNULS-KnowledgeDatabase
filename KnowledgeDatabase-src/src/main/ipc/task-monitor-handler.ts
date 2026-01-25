/**
 * @file 任务监控 IPC Handler
 * @description 处理 Renderer ↔ Main 的任务监控相关 IPC 通信
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { BaseIPCHandler } from './base-handler'
import { globalMonitorBridge } from '../services/global-monitor-bridge'
import type { CreateTaskParams, TaskStatus } from '../../preload/types/task-monitor.types'

export class TaskMonitorIPCHandler extends BaseIPCHandler {
  constructor() {
    super()
    this.register()
    this.setupChangeListener()
    this.setupOneWayListeners()
  }

  private setupOneWayListeners(): void {
    // 单向消息（ipcRenderer.send）不需要返回值
    ipcMain.on('task-monitor:updateprogress', (_event, data) => {
      try {
        globalMonitorBridge.updateProgress(data.taskId, data.progress, data.metaPatch)
      } catch (err) {
        console.error('[TaskMonitorIPC] updateProgress error:', err)
      }
    })
    ipcMain.on('task-monitor:complete', (_event, data) => {
      try {
        globalMonitorBridge.complete(data.taskId, data.metaPatch)
      } catch (err) {
        console.error('[TaskMonitorIPC] complete error:', err)
      }
    })
    ipcMain.on('task-monitor:fail', (_event, data) => {
      try {
        globalMonitorBridge.fail(data.taskId, data.error)
      } catch (err) {
        console.error('[TaskMonitorIPC] fail error:', err)
      }
    })
    ipcMain.on('task-monitor:pause', (_event, data) => {
      try {
        globalMonitorBridge.pause(data.taskId)
      } catch (err) {
        console.error('[TaskMonitorIPC] pause error:', err)
      }
    })
    ipcMain.on('task-monitor:resume', (_event, data) => {
      try {
        globalMonitorBridge.resume(data.taskId)
      } catch (err) {
        console.error('[TaskMonitorIPC] resume error:', err)
      }
    })
  }

  protected getChannelPrefix(): string {
    return 'task-monitor'
  }

  private setupChangeListener(): void {
    globalMonitorBridge.onTasksChanged((tasks) => {
      this.broadcastToAll('task-monitor:changed', tasks)
    })
  }

  // ============================================================================
  // IPC Handlers
  // ============================================================================

  async handleCreate(_event: IpcMainInvokeEvent, params: CreateTaskParams): Promise<string> {
    return globalMonitorBridge.createTask(params)
  }

  async handleGetall(_event: IpcMainInvokeEvent): Promise<any[]> {
    return globalMonitorBridge.getTasks()
  }

  async handleRemove(_event: IpcMainInvokeEvent, taskId: string): Promise<void> {
    await globalMonitorBridge.removeTask(taskId)
  }

  async handleClear(
    _event: IpcMainInvokeEvent,
    filter?: { status?: TaskStatus[] }
  ): Promise<number> {
    return globalMonitorBridge.clearTasks(filter)
  }

  async handleBatchpause(_event: IpcMainInvokeEvent, taskIds: string[]): Promise<void> {
    await globalMonitorBridge.batchPause(taskIds)
  }

  async handleBatchresume(_event: IpcMainInvokeEvent, taskIds: string[]): Promise<void> {
    await globalMonitorBridge.batchResume(taskIds)
  }
}

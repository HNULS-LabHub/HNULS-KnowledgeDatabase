/**
 * @file 全局监控通信桥
 * @description Main 进程与 Utility Process (GlobalMonitor) 之间的通信桥
 */

import { utilityProcess, UtilityProcess } from 'electron'
import path from 'path'
import type {
  TaskRecord,
  TaskStatus,
  CreateTaskParams
} from '../../../preload/types/task-monitor.types'
import type {
  MainToUtilityMessage,
  UtilityToMainMessage
} from '../../../utility/global-monitor/ipc-protocol'

export class GlobalMonitorBridge {
  private process: UtilityProcess | null = null
  private pendingRequests: Map<
    string,
    { resolve: (value: any) => void; reject: (error: Error) => void }
  > = new Map()
  private changeListeners: Set<(tasks: TaskRecord[]) => void> = new Set()
  private isReady = false
  private readyPromise: Promise<void> | null = null
  private readyResolve: (() => void) | null = null

  // ============================================================================
  // 生命周期
  // ============================================================================

  async start(): Promise<void> {
    if (this.process) {
      console.log('[GlobalMonitorBridge] Already started')
      return
    }

    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve
    })

    const modulePath = path.join(__dirname, 'utility/global-monitor.js')
    console.log('[GlobalMonitorBridge] Starting utility process:', modulePath)

    this.process = utilityProcess.fork(modulePath)

    this.process.on('message', (msg: UtilityToMainMessage) => {
      this.handleMessage(msg)
    })

    this.process.on('exit', (code) => {
      console.log('[GlobalMonitorBridge] Process exited with code:', code)
      this.process = null
      this.isReady = false
    })

    await this.readyPromise
    console.log('[GlobalMonitorBridge] Ready')
  }

  stop(): void {
    if (this.process) {
      this.process.kill()
      this.process = null
      this.isReady = false
    }
  }

  // ============================================================================
  // 消息处理
  // ============================================================================

  private handleMessage(msg: UtilityToMainMessage): void {
    switch (msg.type) {
      case 'ready':
        this.isReady = true
        this.readyResolve?.()
        break

      case 'tasksChanged':
        this.notifyChangeListeners(msg.tasks)
        break

      case 'createResult':
      case 'getAllResult':
      case 'removeResult':
      case 'clearResult':
      case 'batchPauseResult':
      case 'batchResumeResult': {
        const pending = this.pendingRequests.get(msg.requestId)
        if (pending) {
          this.pendingRequests.delete(msg.requestId)
          if (msg.type === 'createResult') {
            pending.resolve(msg.taskId)
          } else if (msg.type === 'getAllResult') {
            pending.resolve(msg.tasks)
          } else if (msg.type === 'clearResult') {
            pending.resolve(msg.count)
          } else {
            pending.resolve(msg.success)
          }
        }
        break
      }

      case 'error': {
        if (msg.requestId) {
          const pending = this.pendingRequests.get(msg.requestId)
          if (pending) {
            this.pendingRequests.delete(msg.requestId)
            pending.reject(new Error(msg.message))
          }
        }
        console.error('[GlobalMonitorBridge] Error:', msg.message)
        break
      }
    }
  }

  private send(msg: MainToUtilityMessage): void {
    if (!this.process) {
      throw new Error('GlobalMonitor process not started')
    }
    this.process.postMessage(msg)
  }

  private sendWithResponse<T>(msg: MainToUtilityMessage & { requestId: string }): Promise<T> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(msg.requestId, { resolve, reject })
      this.send(msg)

      // 超时处理
      setTimeout(() => {
        if (this.pendingRequests.has(msg.requestId)) {
          this.pendingRequests.delete(msg.requestId)
          reject(new Error('Request timeout'))
        }
      }, 30000)
    })
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  // ============================================================================
  // 任务操作 API
  // ============================================================================

  async createTask(params: CreateTaskParams): Promise<string> {
    const requestId = this.generateRequestId()
    return this.sendWithResponse<string>({ type: 'create', requestId, params })
  }

  async getTasks(): Promise<TaskRecord[]> {
    const requestId = this.generateRequestId()
    return this.sendWithResponse<TaskRecord[]>({ type: 'getAll', requestId })
  }

  updateProgress(taskId: string, progress: number, metaPatch?: Record<string, unknown>): void {
    this.send({ type: 'updateProgress', taskId, progress, metaPatch })
  }

  complete(taskId: string, metaPatch?: Record<string, unknown>): void {
    this.send({ type: 'complete', taskId, metaPatch })
  }

  fail(taskId: string, error: string): void {
    this.send({ type: 'fail', taskId, error })
  }

  pause(taskId: string): void {
    this.send({ type: 'pause', taskId })
  }

  resume(taskId: string): void {
    this.send({ type: 'resume', taskId })
  }

  async removeTask(taskId: string): Promise<boolean> {
    const requestId = this.generateRequestId()
    return this.sendWithResponse<boolean>({ type: 'remove', requestId, taskId })
  }

  async clearTasks(filter?: { status?: TaskStatus[] }): Promise<number> {
    const requestId = this.generateRequestId()
    return this.sendWithResponse<number>({ type: 'clear', requestId, filter })
  }

  async batchPause(taskIds: string[]): Promise<boolean> {
    const requestId = this.generateRequestId()
    return this.sendWithResponse<boolean>({ type: 'batchPause', requestId, taskIds })
  }

  async batchResume(taskIds: string[]): Promise<boolean> {
    const requestId = this.generateRequestId()
    return this.sendWithResponse<boolean>({ type: 'batchResume', requestId, taskIds })
  }

  // ============================================================================
  // 订阅
  // ============================================================================

  onTasksChanged(callback: (tasks: TaskRecord[]) => void): () => void {
    this.changeListeners.add(callback)
    return () => {
      this.changeListeners.delete(callback)
    }
  }

  private notifyChangeListeners(tasks: TaskRecord[]): void {
    for (const listener of this.changeListeners) {
      try {
        listener(tasks)
      } catch (err) {
        console.error('[GlobalMonitorBridge] Listener error:', err)
      }
    }
  }
}

// 单例导出
export const globalMonitorBridge = new GlobalMonitorBridge()

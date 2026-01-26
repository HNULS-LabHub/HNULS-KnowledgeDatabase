/**
 * @file 嵌入引擎通信桥
 * @description Main 进程与 Utility Process (EmbeddingEngine) 之间的通信桥
 */

import { utilityProcess, UtilityProcess, BrowserWindow } from 'electron'
import path from 'path'
import type {
  SubmitEmbeddingTaskParams,
  EmbeddingTaskResult,
  EmbeddingTaskInfo,
  EmbeddingChannelInfo
} from '../../../preload/types/embedding.types'
import type {
  MainToEngineMessage,
  EngineToMainMessage
} from '../../../utility/embedding-engine/ipc-protocol'
import type { ChannelConfig } from '../../../utility/embedding-engine/types'
import { globalMonitorBridge } from '../global-monitor-bridge'

// ============================================================================
// 类型定义
// ============================================================================

interface PendingRequest<T> {
  resolve: (value: T) => void
  reject: (error: Error) => void
}

// ============================================================================
// EmbeddingEngineBridge
// ============================================================================

export class EmbeddingEngineBridge {
  private process: UtilityProcess | null = null
  private pendingRequests: Map<string, PendingRequest<any>> = new Map()
  private isReady = false
  private readyPromise: Promise<void> | null = null
  private readyResolve: (() => void) | null = null

  /** 任务 ID -> 文档 ID 映射 */
  private taskToDocumentMap: Map<string, string> = new Map()

  /** 完成事件监听器 */
  private completedListeners: Set<(result: EmbeddingTaskResult) => void> = new Set()
  /** 失败事件监听器 */
  private failedListeners: Set<(error: { documentId: string; error: string }) => void> = new Set()

  // ==========================================================================
  // 生命周期
  // ==========================================================================

  async start(): Promise<void> {
    if (this.process) {
      console.log('[EmbeddingEngineBridge] Already started')
      return
    }

    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve
    })

    const modulePath = path.join(__dirname, 'utility/embedding-engine.js')
    console.log('[EmbeddingEngineBridge] Starting utility process:', modulePath)

    this.process = utilityProcess.fork(modulePath)

    this.process.on('message', (msg: EngineToMainMessage) => {
      this.handleMessage(msg)
    })

    this.process.on('exit', (code) => {
      console.log('[EmbeddingEngineBridge] Process exited with code:', code)
      this.process = null
      this.isReady = false
    })

    await this.readyPromise
    console.log('[EmbeddingEngineBridge] Ready')
  }

  stop(): void {
    if (this.process) {
      this.process.kill()
      this.process = null
      this.isReady = false
    }
  }

  // ==========================================================================
  // 消息处理
  // ==========================================================================

  private handleMessage(msg: EngineToMainMessage): void {
    switch (msg.type) {
      case 'ready':
        this.isReady = true
        this.readyResolve?.()
        break

      case 'task:started': {
        const pending = this.pendingRequests.get(msg.requestId)
        if (pending) {
          this.pendingRequests.delete(msg.requestId)
          this.taskToDocumentMap.set(msg.taskId, msg.documentId)
          pending.resolve(msg.taskId)
        }
        break
      }

      case 'task:progress': {
        // 转发进度到 GlobalMonitor
        globalMonitorBridge.updateProgress(msg.taskId, msg.progress, {
          documentId: msg.documentId,
          completedChunks: msg.completedChunks,
          totalChunks: msg.totalChunks,
          currentRPM: msg.currentRPM
        })

        // 广播进度到所有窗口
        this.broadcastToRenderers('embedding:progress', {
          documentId: msg.documentId,
          taskId: msg.taskId,
          progress: msg.progress,
          completedChunks: msg.completedChunks,
          totalChunks: msg.totalChunks,
          currentRPM: msg.currentRPM
        })
        break
      }

      case 'task:completed': {
        // 通知 GlobalMonitor 完成
        globalMonitorBridge.complete(msg.taskId)

        // 通知监听器
        const result: EmbeddingTaskResult = {
          documentId: msg.documentId,
          embeddings: msg.embeddings,
          completedAt: Date.now()
        }
        for (const listener of this.completedListeners) {
          try {
            listener(result)
          } catch (err) {
            console.error('[EmbeddingEngineBridge] Completed listener error:', err)
          }
        }

        // 广播到渲染进程
        this.broadcastToRenderers('embedding:completed', result)
        break
      }

      case 'task:failed': {
        // 通知 GlobalMonitor 失败
        globalMonitorBridge.fail(msg.taskId, msg.error)

        // 通知监听器
        const error = { documentId: msg.documentId, error: msg.error }
        for (const listener of this.failedListeners) {
          try {
            listener(error)
          } catch (err) {
            console.error('[EmbeddingEngineBridge] Failed listener error:', err)
          }
        }

        // 广播到渲染进程
        this.broadcastToRenderers('embedding:failed', error)
        break
      }

      case 'task:paused':
      case 'task:resumed':
      case 'task:cancelled': {
        // 通知 GlobalMonitor 状态变更
        if (msg.type === 'task:paused') {
          globalMonitorBridge.pause(msg.taskId)
        } else if (msg.type === 'task:resumed') {
          globalMonitorBridge.resume(msg.taskId)
        }
        break
      }

      case 'query:task-info:result': {
        const pending = this.pendingRequests.get(msg.requestId)
        if (pending) {
          this.pendingRequests.delete(msg.requestId)
          pending.resolve(msg.data)
        }
        break
      }

      case 'query:channels:result': {
        const pending = this.pendingRequests.get(msg.requestId)
        if (pending) {
          this.pendingRequests.delete(msg.requestId)
          pending.resolve(msg.channels)
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
        console.error('[EmbeddingEngineBridge] Error:', msg.message)
        break
      }
    }
  }

  private send(msg: MainToEngineMessage): void {
    if (!this.process) {
      throw new Error('EmbeddingEngine process not started')
    }
    this.process.postMessage(msg)
  }

  private sendWithResponse<T>(msg: MainToEngineMessage & { requestId: string }): Promise<T> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(msg.requestId, { resolve, reject })
      this.send(msg)

      // 超时处理
      setTimeout(() => {
        if (this.pendingRequests.has(msg.requestId)) {
          this.pendingRequests.delete(msg.requestId)
          reject(new Error('Request timeout'))
        }
      }, 60000) // 60 秒超时
    })
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  private broadcastToRenderers(channel: string, data: unknown): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    }
  }

  // ==========================================================================
  // 任务操作 API
  // ==========================================================================

  async submitTask(params: SubmitEmbeddingTaskParams): Promise<string> {
    // 1. 先在 GlobalMonitor 创建任务
    const taskId = await globalMonitorBridge.createTask({
      type: 'embedding',
      title: `嵌入: ${params.meta?.fileName || params.documentId}`,
      meta: {
        documentId: params.documentId,
        totalChunks: params.chunks.length
      }
    })

    // 2. 发送给嵌入引擎
    const requestId = this.generateRequestId()
    return this.sendWithResponse<string>({
      type: 'embed:start',
      requestId,
      data: {
        ...params,
        taskId
      }
    })
  }

  pauseTask(documentId: string): void {
    this.send({ type: 'embed:pause', documentId })
  }

  resumeTask(documentId: string): void {
    this.send({ type: 'embed:resume', documentId })
  }

  cancelTask(documentId: string): void {
    this.send({ type: 'embed:cancel', documentId })
  }

  async getTaskInfo(documentId: string): Promise<EmbeddingTaskInfo | null> {
    const requestId = this.generateRequestId()
    return this.sendWithResponse<EmbeddingTaskInfo | null>({
      type: 'query:task-info',
      requestId,
      documentId
    })
  }

  setConcurrency(concurrency: number): void {
    this.send({ type: 'config:set-concurrency', concurrency })
  }

  updateChannels(channels: ChannelConfig[]): void {
    this.send({ type: 'config:update-channels', channels })
  }

  async getChannels(): Promise<EmbeddingChannelInfo[]> {
    const requestId = this.generateRequestId()
    return this.sendWithResponse<EmbeddingChannelInfo[]>({
      type: 'query:channels',
      requestId
    })
  }

  // ==========================================================================
  // 事件监听
  // ==========================================================================

  onCompleted(listener: (result: EmbeddingTaskResult) => void): () => void {
    this.completedListeners.add(listener)
    return () => {
      this.completedListeners.delete(listener)
    }
  }

  onFailed(listener: (error: { documentId: string; error: string }) => void): () => void {
    this.failedListeners.add(listener)
    return () => {
      this.failedListeners.delete(listener)
    }
  }
}

// 单例导出
export const embeddingEngineBridge = new EmbeddingEngineBridge()

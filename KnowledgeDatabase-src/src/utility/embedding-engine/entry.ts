/**
 * @file 嵌入引擎入口
 * @description Utility Process 入口文件，管理向量嵌入任务
 */

import { TaskManager } from './core/task-manager'
import { Scheduler } from './core/scheduler'
import { ProgressTracker } from './core/progress-tracker'
import { ChannelManager } from './channel/channel-manager'
import { TaskMonitorBridge } from './bridge/task-monitor-bridge'
import type { MainToEngineMessage, EngineToMainMessage } from './ipc-protocol'
import type { ChannelConfig } from './types'

// ============================================================================
// 日志
// ============================================================================

const log = (msg: string): void => {
  console.log(`[EmbeddingEngine] ${msg}`)
}

log('Starting Embedding Engine Process...')

// ============================================================================
// Electron Utility Process 使用 process.parentPort
// ============================================================================

const parentPort = process.parentPort
if (!parentPort) {
  log('Error: Not running inside a UtilityProcess.')
  process.exit(1)
}

// ============================================================================
// 发送消息到 Main 进程
// ============================================================================

function sendMessage(msg: EngineToMainMessage): void {
  parentPort?.postMessage(msg)
}

// ============================================================================
// 初始化核心模块
// ============================================================================

const taskMonitorBridge = new TaskMonitorBridge(sendMessage)
const taskManager = new TaskManager()
const progressTracker = new ProgressTracker(taskManager, taskMonitorBridge)
const channelManager = new ChannelManager()
const scheduler = new Scheduler(taskManager, channelManager, progressTracker, sendMessage)

// ============================================================================
// 消息处理
// ============================================================================

parentPort.on('message', (event: { data: MainToEngineMessage }) => {
  const msg = event.data
  log(`Received: ${msg?.type}`)

  try {
    switch (msg.type) {
      case 'embed:start': {
        const { requestId, data } = msg
        const { documentId, chunks, embeddingConfig, meta, taskId } = data

        // 创建文档任务
        taskManager.createDocumentTask({
          documentId,
          taskId,
          totalChunks: chunks.length,
          embeddingConfig,
          meta
        })

        // 添加 chunks 到任务管理器
        taskManager.addChunks(
          documentId,
          chunks.map((c) => ({ index: c.index, text: c.text }))
        )

        // 将 chunks 加入调度队列
        const chunkTasks = taskManager.getPendingChunks(documentId)
        scheduler.enqueue(chunkTasks)

        // 回复任务已启动
        sendMessage({
          type: 'task:started',
          requestId,
          documentId,
          taskId
        })
        break
      }

      case 'embed:pause': {
        const { documentId } = msg
        const docTask = taskManager.getDocumentTask(documentId)
        if (docTask) {
          taskManager.updateDocumentStatus(documentId, 'paused')
          scheduler.pause(documentId)
          sendMessage({
            type: 'task:paused',
            documentId,
            taskId: docTask.taskId
          })
        }
        break
      }

      case 'embed:resume': {
        const { documentId } = msg
        const docTask = taskManager.getDocumentTask(documentId)
        if (docTask) {
          taskManager.updateDocumentStatus(documentId, 'running')
          scheduler.resume(documentId)
          sendMessage({
            type: 'task:resumed',
            documentId,
            taskId: docTask.taskId
          })
        }
        break
      }

      case 'embed:cancel': {
        const { documentId } = msg
        const docTask = taskManager.getDocumentTask(documentId)
        if (docTask) {
          taskManager.updateDocumentStatus(documentId, 'cancelled')
          scheduler.cancel(documentId)
          sendMessage({
            type: 'task:cancelled',
            documentId,
            taskId: docTask.taskId
          })
        }
        break
      }

      case 'config:update-channels': {
        const { channels } = msg
        channelManager.updateChannels(channels as ChannelConfig[])
        break
      }

      case 'config:set-concurrency': {
        const { concurrency } = msg
        scheduler.setConcurrency(concurrency)
        break
      }

      case 'query:task-info': {
        const { requestId, documentId } = msg
        const docTask = taskManager.getDocumentTask(documentId)
        sendMessage({
          type: 'query:task-info:result',
          requestId,
          data: docTask
            ? {
                taskId: docTask.taskId,
                documentId: docTask.documentId,
                status: docTask.status,
                progress: (docTask.completedChunks / docTask.totalChunks) * 100,
                completedChunks: docTask.completedChunks,
                totalChunks: docTask.totalChunks,
                createdAt: docTask.createdAt,
                updatedAt: docTask.updatedAt
              }
            : null
        })
        break
      }

      case 'query:channels': {
        const { requestId } = msg
        const channels = channelManager.getChannelInfos()
        sendMessage({
          type: 'query:channels:result',
          requestId,
          channels
        })
        break
      }

      default:
        log(`Unknown message type: ${(msg as any).type}`)
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    log(`Error handling ${msg.type}: ${errorMsg}`)
    sendMessage({
      type: 'error',
      requestId: (msg as any).requestId,
      message: errorMsg
    })
  }
})

// ============================================================================
// 发送就绪信号
// ============================================================================

sendMessage({ type: 'ready' })
log('Embedding Engine ready.')

// ============================================================================
// 保活
// ============================================================================

setInterval(() => {
  // heartbeat
}, 1000 * 60)

/**
 * @file 全局监控服务入口
 * @description Utility Process 入口文件，管理全局任务状态
 */

import { TaskRegistry } from './task-registry'
import type { MainToUtilityMessage, UtilityToMainMessage } from './ipc-protocol'

const log = (msg: string): void => {
  console.log(`[GlobalMonitor] ${msg}`)
}

log('Starting Global Monitor Service...')

// Electron utilityProcess 使用 process.parentPort，不是 worker_threads
const parentPort = process.parentPort
if (!parentPort) {
  log('Error: Not running inside a UtilityProcess.')
  process.exit(1)
}

// 创建任务注册表
const registry = new TaskRegistry()

// 订阅变更，广播给 Main 进程
registry.subscribe((tasks) => {
  sendMessage({ type: 'tasksChanged', tasks })
})

// 发送消息到 Main 进程
function sendMessage(msg: UtilityToMainMessage): void {
  parentPort?.postMessage(msg)
}

// 处理来自 Main 进程的消息
// 注意：Electron UtilityProcess 的 message 事件传递的是 { data: actualMessage }
parentPort.on('message', (event: { data: MainToUtilityMessage }) => {
  const msg = event.data
  // 过滤掉 updateProgress 的日志噪音
  if (msg?.type !== 'updateProgress') {
    log(`Received: ${msg?.type}`)
  }

  try {
    switch (msg.type) {
      case 'create': {
        const taskId = registry.create(msg.params)
        sendMessage({ type: 'createResult', requestId: msg.requestId, taskId })
        break
      }

      case 'updateProgress': {
        registry.updateProgress(msg.taskId, msg.progress, msg.metaPatch)
        break
      }

      case 'complete': {
        registry.complete(msg.taskId, msg.metaPatch)
        break
      }

      case 'fail': {
        registry.fail(msg.taskId, msg.error)
        break
      }

      case 'pause': {
        registry.pause(msg.taskId)
        break
      }

      case 'resume': {
        registry.resume(msg.taskId)
        break
      }

      case 'remove': {
        const success = registry.remove(msg.taskId)
        sendMessage({ type: 'removeResult', requestId: msg.requestId, success })
        break
      }

      case 'clear': {
        const count = registry.clear(msg.filter)
        sendMessage({ type: 'clearResult', requestId: msg.requestId, count })
        break
      }

      case 'getAll': {
        const tasks = registry.getAll()
        sendMessage({ type: 'getAllResult', requestId: msg.requestId, tasks })
        break
      }

      case 'batchPause': {
        registry.batchPause(msg.taskIds)
        sendMessage({ type: 'batchPauseResult', requestId: msg.requestId, success: true })
        break
      }

      case 'batchResume': {
        registry.batchResume(msg.taskIds)
        sendMessage({ type: 'batchResumeResult', requestId: msg.requestId, success: true })
        break
      }

      default:
        log(`Unknown message type: ${(msg as any).type}`)
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    log(`Error handling ${msg.type}: ${errorMsg}`)
    sendMessage({ type: 'error', requestId: (msg as any).requestId, message: errorMsg })
  }
})

// 发送就绪信号
sendMessage({ type: 'ready' })
log('Global Monitor Service ready.')

// 保活
setInterval(() => {
  // heartbeat
}, 1000 * 60)

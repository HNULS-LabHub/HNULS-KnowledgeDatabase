/**
 * @file 知识图谱子进程入口
 * @description Utility Process 入口文件，管理知识图谱构建任务
 */

import { KGSurrealClient } from './db/surreal-client'
import { TaskSubmissionService } from './service/task-submission'
import { GraphQueryService } from './service/graph-query'
import { TaskScheduler } from './core/task-scheduler'
import { GraphBuildScheduler } from './core/graph-build-scheduler'
import { EmbeddingScheduler } from './core/embedding-scheduler'
import { RetrievalOrchestrator } from './service/kg-retrieval'
import { MessageHandler } from './bridge/message-handler'
import type {
  MainToKGMessage,
  KGToMainMessage,
  KGModelProviderConfig
} from '@shared/knowledge-graph-ipc.types'

// ============================================================================
// 日志转发：子进程 console → postMessage → 主进程 logger
// ============================================================================

const parentPort = process.parentPort
if (!parentPort) {
  console.error('[KnowledgeGraph] Error: Not running inside a UtilityProcess.')
  process.exit(1)
}

// ============================================================================
// 全局错误捕获：防止静默退出
// ============================================================================

process.on('uncaughtException', (error) => {
  console.error('[KnowledgeGraph] Uncaught Exception:', error.message, error.stack)
  parentPort?.postMessage({
    type: 'kg:log',
    level: 'error',
    message: `Uncaught Exception: ${error.message}\n${error.stack ?? ''}`
  })
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? `${reason.message}\n${reason.stack}` : String(reason)
  console.error('[KnowledgeGraph] Unhandled Rejection:', msg)
  parentPort?.postMessage({
    type: 'kg:log',
    level: 'error',
    message: `Unhandled Rejection: ${msg}`
  })
})

// 拦截 console，转发到主进程
const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console)
}

function forwardLog(level: 'debug' | 'info' | 'warn' | 'error', args: any[]): void {
  const message = args
    .map((a) => {
      if (a instanceof Error) return `${a.message}\n${a.stack ?? ''}`
      if (typeof a === 'object') {
        try {
          return JSON.stringify(a)
        } catch {
          return String(a)
        }
      }
      return String(a)
    })
    .join(' ')

  parentPort?.postMessage({
    type: 'kg:log',
    level,
    message
  } satisfies KGToMainMessage)
}

console.log = (...args: any[]) => {
  originalConsole.log(...args)
  forwardLog('info', args)
}
console.info = (...args: any[]) => {
  originalConsole.info(...args)
  forwardLog('info', args)
}
console.warn = (...args: any[]) => {
  originalConsole.warn(...args)
  forwardLog('warn', args)
}
console.error = (...args: any[]) => {
  originalConsole.error(...args)
  forwardLog('error', args)
}
console.debug = (...args: any[]) => {
  originalConsole.debug(...args)
  forwardLog('debug', args)
}

// ============================================================================
// 发送消息到 Main 进程
// ============================================================================

function sendMessage(msg: KGToMainMessage): void {
  parentPort?.postMessage(msg)
}

// ============================================================================
// 并发数请求机制
// ============================================================================

let cachedConcurrency = 5
let pendingConcurrencyResolve: ((value: number) => void) | null = null

function requestConcurrency(): Promise<number> {
  return new Promise((resolve) => {
    pendingConcurrencyResolve = resolve
    sendMessage({ type: 'kg:request-concurrency' })
    // 超时 500ms 使用缓存值
    setTimeout(() => {
      if (pendingConcurrencyResolve === resolve) {
        pendingConcurrencyResolve = null
        resolve(cachedConcurrency)
      }
    }, 500)
  })
}

function handleConcurrencyResponse(value: number): void {
  cachedConcurrency = value
  if (pendingConcurrencyResolve) {
    pendingConcurrencyResolve(value)
    pendingConcurrencyResolve = null
  }
}

// ============================================================================
// 初始化核心模块
// ============================================================================

const surrealClient = new KGSurrealClient()
const taskSubmission = new TaskSubmissionService(surrealClient)
const graphQueryService = new GraphQueryService(surrealClient, sendMessage)
const scheduler = new TaskScheduler(surrealClient, sendMessage, requestConcurrency)
const graphBuildScheduler = new GraphBuildScheduler(surrealClient, sendMessage)
const embeddingScheduler = new EmbeddingScheduler(surrealClient, sendMessage)
const retrievalOrchestrator = new RetrievalOrchestrator(
  surrealClient,
  new Map<string, KGModelProviderConfig>()
)
const messageHandler = new MessageHandler(
  surrealClient,
  taskSubmission,
  scheduler,
  graphBuildScheduler,
  graphQueryService,
  embeddingScheduler,
  retrievalOrchestrator,
  sendMessage
)

// 胶水：第一阶段完成 → kick 第二阶段
scheduler.onTaskCompleted = () => graphBuildScheduler.kick()

// 启动调度器（无需等待 init，内部会自行等待连接）
scheduler.start().catch((error) => {
  console.error('[KnowledgeGraph] Failed to start scheduler:', error)
})
graphBuildScheduler.start().catch((error) => {
  console.error('[KnowledgeGraph] Failed to start graph build scheduler:', error)
})
embeddingScheduler.start()

// ============================================================================
// 消息处理
// ============================================================================

parentPort.on('message', async (event: { data: MainToKGMessage }) => {
  const msg = event.data
  if (msg.type === 'kg:concurrency-response') {
    handleConcurrencyResponse(msg.value)
    return
  }
  if (msg.type === 'kg:update-concurrency') {
    handleConcurrencyResponse(msg.maxConcurrency)
    return
  }
  await messageHandler.handle(msg)
})

// ============================================================================
// 发送就绪信号
// ============================================================================

sendMessage({ type: 'kg:ready' })
originalConsole.log('[KnowledgeGraph] Knowledge Graph process ready.')

// ============================================================================
// 保活
// ============================================================================

setInterval(() => {
  // heartbeat
}, 1000 * 60)

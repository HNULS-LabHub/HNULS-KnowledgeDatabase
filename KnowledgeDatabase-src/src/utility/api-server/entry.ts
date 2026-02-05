/**
 * @file API Server 入口
 * @description Utility Process 入口文件，运行 Express HTTP 服务器
 */

import type { Server } from 'http'
import { SurrealClient } from './db/surreal-client'
import { createApp, getRequestCount, getUptime } from './app'
import type {
  MainToApiServerMessage,
  ApiServerToMainMessage,
  ApiServerConfig,
  ApiServerDBConfig
} from '@shared/api-server.types'

// ============================================================================
// 日志
// ============================================================================

const log = (msg: string): void => {
  console.log(`[ApiServer] ${msg}`)
}

log('Starting API Server Process...')

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

function sendMessage(msg: ApiServerToMainMessage): void {
  parentPort?.postMessage(msg)
}

// ============================================================================
// 核心状态
// ============================================================================

let surrealClient: SurrealClient | null = null
let httpServer: Server | null = null
let serverConfig: ApiServerConfig | null = null
let metaFilePath: string = ''

// ============================================================================
// 启动/停止逻辑
// ============================================================================

async function startServer(
  config: ApiServerConfig,
  dbConfig: ApiServerDBConfig,
  metaPath: string
): Promise<void> {
  if (httpServer) {
    log('Server already running')
    return
  }

  serverConfig = config
  metaFilePath = metaPath

  try {
    // 1. 连接数据库
    surrealClient = new SurrealClient()
    await surrealClient.connect(dbConfig)
    log('Database connected')

    // 2. 创建 Express 应用
    const app = createApp(surrealClient, metaFilePath)

    // 3. 启动 HTTP 服务器
    httpServer = app.listen(config.port, config.host, () => {
      log(`Server started on http://${config.host}:${config.port}`)
      sendMessage({
        type: 'server:started',
        port: config.port,
        host: config.host
      })
    })

    httpServer.on('error', (err: Error) => {
      log(`Server error: ${err.message}`)
      sendMessage({
        type: 'server:error',
        message: err.message
      })
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    log(`Start failed: ${msg}`)
    sendMessage({
      type: 'server:error',
      message: 'Failed to start server',
      details: msg
    })
  }
}

async function stopServer(): Promise<void> {
  if (!httpServer) {
    log('Server not running')
    return
  }

  // 关闭 HTTP 服务器
  await new Promise<void>((resolve) => {
    httpServer?.close(() => {
      log('HTTP server closed')
      resolve()
    })
  })

  // 断开数据库
  if (surrealClient) {
    await surrealClient.disconnect()
    surrealClient = null
  }

  httpServer = null
  serverConfig = null

  log('Server stopped')
  sendMessage({ type: 'server:stopped' })
}

// ============================================================================
// 消息处理
// ============================================================================

parentPort.on('message', async (event: { data: MainToApiServerMessage }) => {
  const msg = event.data
  log(`Received: ${msg?.type}`)

  try {
    switch (msg.type) {
      case 'server:start': {
        await startServer(msg.config, msg.dbConfig, msg.metaFilePath)
        break
      }

      case 'server:stop': {
        await stopServer()
        break
      }

      case 'server:query-status': {
        sendMessage({
          type: 'server:status',
          requestId: msg.requestId,
          status: {
            running: !!httpServer,
            port: serverConfig?.port ?? null,
            host: serverConfig?.host ?? null,
            uptime: getUptime(),
            requestCount: getRequestCount()
          }
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
      type: 'server:error',
      message: errorMsg
    })
  }
})

// ============================================================================
// 发送就绪信号
// ============================================================================

sendMessage({ type: 'server:ready' })
log('API Server ready.')

// ============================================================================
// 保活
// ============================================================================

setInterval(() => {
  // heartbeat
}, 1000 * 60)

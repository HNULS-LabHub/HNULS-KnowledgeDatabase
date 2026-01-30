/**
 * @file 向量索引器入口
 * @description Utility Process 入口文件，负责从暂存表搬运数据到目标向量表
 */

import { SurrealClient } from './db/surreal-client'
import { StagingPoller } from './core/staging-poller'
import { TransferWorker } from './core/transfer-worker'
import type {
  MainToIndexerMessage,
  IndexerToMainMessage,
  IndexerConfig,
  IndexerStats
} from '@shared/vector-indexer-ipc.types'

// ============================================================================
// 日志
// ============================================================================

const log = (msg: string): void => {
  console.log(`[VectorIndexer] ${msg}`)
}

log('Starting Vector Indexer Process...')

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

function sendMessage(msg: IndexerToMainMessage): void {
  parentPort?.postMessage(msg)
}

// ============================================================================
// 核心模块实例
// ============================================================================

let surrealClient: SurrealClient | null = null
let stagingPoller: StagingPoller | null = null
let transferWorker: TransferWorker | null = null
let isRunning = false

// ============================================================================
// 默认配置
// ============================================================================

const defaultConfig: IndexerConfig = {
  batchSize: 4000,
  maxConcurrentTables: 5,
  pollIntervalActive: 1000,   // 降低到 500ms，更快响应
  pollIntervalIdle: 5000,
  processingTimeout: 5 * 60 * 1000
}

// ============================================================================
// 统计信息
// ============================================================================

let lastPollTime = 0

function getStats(): IndexerStats {
  return {
    totalTransferred: transferWorker?.getTotalTransferred() ?? 0,
    currentBatchProcessed: 0,
    currentBatchTotal: 0,
    activeTableCount: transferWorker?.getActiveTableCount() ?? 0,
    lastPollTime,
    isActive: isRunning
  }
}

// ============================================================================
// 启动/停止逻辑
// ============================================================================

async function startIndexer(
  dbConfig: { serverUrl: string; username: string; password: string; namespace: string; database: string },
  config: Partial<IndexerConfig> = {}
): Promise<void> {
  if (isRunning) {
    log('Already running')
    return
  }

  const mergedConfig = { ...defaultConfig, ...config }

  try {
    // 初始化 SurrealDB 客户端
    surrealClient = new SurrealClient()
    await surrealClient.connect(dbConfig)

    // 初始化 TransferWorker
    transferWorker = new TransferWorker(surrealClient, mergedConfig, {
      onBatchCompleted: (tableName, count, duration) => {
        sendMessage({
          type: 'indexer:batch-completed',
          tableName,
          count,
          duration
        })
      },
      onError: (message, details) => {
        sendMessage({
          type: 'indexer:error',
          message,
          details
        })
      },
      onProgress: (transferred, pending, activeTableCount) => {
        sendMessage({
          type: 'indexer:progress',
          transferred,
          pending,
          activeTableCount
        })
      },
      onDocumentEmbedded: (info) => {
        sendMessage({
          type: 'indexer:document-embedded',
          targetNamespace: info.targetNamespace,
          targetDatabase: info.targetDatabase,
          documentId: info.documentId,
          fileKey: info.fileKey,
          embeddingConfigId: info.embeddingConfigId,
          dimensions: info.dimensions,
          chunkCount: info.chunkCount
        })
      }
    })

    // 初始化 StagingPoller
    stagingPoller = new StagingPoller(surrealClient, mergedConfig)

    // 启动轮询
    stagingPoller.start(async (groups) => {
      lastPollTime = Date.now()
      if (transferWorker) {
        await transferWorker.processGroups(groups)
      }
    })

    isRunning = true
    log('Started successfully')
    sendMessage({ type: 'indexer:started' })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    log(`Start failed: ${msg}`)
    sendMessage({
      type: 'indexer:error',
      message: 'Failed to start indexer',
      details: msg
    })
  }
}

async function stopIndexer(): Promise<void> {
  if (!isRunning) {
    log('Not running')
    return
  }

  stagingPoller?.stop()
  await surrealClient?.disconnect()

  stagingPoller = null
  transferWorker = null
  surrealClient = null
  isRunning = false

  log('Stopped')
  sendMessage({ type: 'indexer:stopped' })
}

// ============================================================================
// 消息处理
// ============================================================================

parentPort.on('message', async (event: { data: MainToIndexerMessage }) => {
  const msg = event.data
  log(`Received: ${msg?.type}`)

  try {
    switch (msg.type) {
      case 'indexer:start': {
        await startIndexer(msg.dbConfig, msg.config)
        break
      }

      case 'indexer:stop': {
        await stopIndexer()
        break
      }

      case 'indexer:config': {
        stagingPoller?.updateConfig(msg.config)
        transferWorker?.updateConfig(msg.config)
        log('Config updated')
        break
      }

      case 'indexer:query-stats': {
        sendMessage({
          type: 'indexer:stats',
          requestId: msg.requestId,
          stats: getStats()
        })
        break
      }

      case 'indexer:query-staging-status': {
        // 查询暂存表状态
        const status = stagingPoller
          ? await stagingPoller.getStagingStatus()
          : {
              state: 'idle' as const,
              total: 0,
              processed: 0,
              pending: 0,
              progress: null,
              processing: 0
            }
        sendMessage({
          type: 'indexer:staging-status',
          requestId: msg.requestId,
          status
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
      type: 'indexer:error',
      message: errorMsg
    })
  }
})

// ============================================================================
// 发送就绪信号
// ============================================================================

sendMessage({ type: 'indexer:ready' })
log('Vector Indexer ready.')

// ============================================================================
// 保活
// ============================================================================

setInterval(() => {
  // heartbeat
}, 1000 * 60)

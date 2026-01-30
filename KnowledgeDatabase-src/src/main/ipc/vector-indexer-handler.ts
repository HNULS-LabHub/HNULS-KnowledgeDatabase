/**
 * @file 向量索引器 IPC Handler
 * @description 处理渲染进程对向量索引器的请求
 */

import { ipcMain } from 'electron'
import { vectorIndexerBridge } from '../services/vector-indexer-bridge'
import { logger } from '../services/logger'

// ============================================================================
// IPC Channel 常量
// ============================================================================

const IPC_CHANNELS = {
  GET_STAGING_STATUS: 'vector-indexer:get-staging-status'
} as const

// ============================================================================
// Handler 实现
// ============================================================================

export function registerVectorIndexerHandlers(): void {
  /**
   * 获取暂存表状态
   */
  ipcMain.handle(IPC_CHANNELS.GET_STAGING_STATUS, async () => {
    try {
      const status = await vectorIndexerBridge.getStagingStatus()
      return status
    } catch (error) {
      logger.error('[VectorIndexerHandler] Failed to get staging status:', error)
      return null
    }
  })

  logger.info('[VectorIndexerHandler] Handlers registered')
}

/**
 * 清理 handlers
 */
export function unregisterVectorIndexerHandlers(): void {
  ipcMain.removeHandler(IPC_CHANNELS.GET_STAGING_STATUS)
  logger.info('[VectorIndexerHandler] Handlers unregistered')
}

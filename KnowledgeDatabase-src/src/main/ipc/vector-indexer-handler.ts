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
  GET_STAGING_STATUS: 'vector-indexer:get-staging-status',
  UPDATE_CONFIG: 'vector-indexer:update-config'
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

  /**
   * 更新索引器配置
   */
  ipcMain.handle(IPC_CHANNELS.UPDATE_CONFIG, async (_event, config: { batchSize?: number }) => {
    try {
      vectorIndexerBridge.updateConfig(config)
      logger.info('[VectorIndexerHandler] Config updated:', config)
    } catch (error) {
      logger.error('[VectorIndexerHandler] Failed to update config:', error)
    }
  })

  logger.info('[VectorIndexerHandler] Handlers registered')
}

/**
 * 清理 handlers
 */
export function unregisterVectorIndexerHandlers(): void {
  ipcMain.removeHandler(IPC_CHANNELS.GET_STAGING_STATUS)
  ipcMain.removeHandler(IPC_CHANNELS.UPDATE_CONFIG)
  logger.info('[VectorIndexerHandler] Handlers unregistered')
}

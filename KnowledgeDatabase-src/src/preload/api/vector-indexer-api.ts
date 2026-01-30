/**
 * @file 向量索引器 Preload API
 * @description 提供向量索引器相关的 IPC 通信接口
 */

import { ipcRenderer } from 'electron'
import type { VectorIndexerAPI, StagingStatus } from '../types/vector-indexer.types'

// ============================================================================
// IPC Channel 常量
// ============================================================================

const IPC_CHANNELS = {
  GET_STAGING_STATUS: 'vector-indexer:get-staging-status'
} as const

// ============================================================================
// API 实现
// ============================================================================

export const vectorIndexerAPI: VectorIndexerAPI = {
  async getStagingStatus(): Promise<StagingStatus | null> {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_STAGING_STATUS)
  }
}

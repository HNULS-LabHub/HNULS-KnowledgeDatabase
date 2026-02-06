/**
 * @file 向量召回 Preload API
 * @description 提供向量召回相关的 IPC 通信接口
 */

import { ipcRenderer } from 'electron'
import type {
  VectorRetrievalAPI,
  VectorRetrievalSearchParams,
  VectorRetrievalSearchResult
} from '../types/vector-retrieval.types'

// ============================================================================
// IPC Channel 常量
// ============================================================================

const IPC_CHANNELS = {
  SEARCH: 'vector-retrieval:search'
} as const

// ============================================================================
// API 实现
// ============================================================================

export const vectorRetrievalAPI: VectorRetrievalAPI = {
  async search(params: VectorRetrievalSearchParams): Promise<VectorRetrievalSearchResult> {
    return ipcRenderer.invoke(IPC_CHANNELS.SEARCH, params)
  }
}

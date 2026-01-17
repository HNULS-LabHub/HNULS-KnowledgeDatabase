import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ChunkingDataSource } from './chunking.datasource'
import type { FileChunkingState, ChunkingConfig } from './chunking.types'

/**
 * 分块状态管理 Store
 * 简化版，不需要版本管理（与 parsing store 的区别）
 */
export const useChunkingStore = defineStore('chunking', () => {
  const fileStates = ref<Map<string, FileChunkingState>>(new Map())
  const loadingByFileKey = ref<Map<string, boolean>>(new Map())

  const isLoading = computed(
    () => (fileKey: string) => loadingByFileKey.value.get(fileKey) === true
  )

  /**
   * 获取文件的分块状态
   */
  const getState = computed(() => (fileKey: string): FileChunkingState | null => {
    return fileStates.value.get(fileKey) ?? null
  })

  /**
   * 确保文件的分块状态已加载
   * @param fileKey 文件标识
   * @param config 分块配置
   * @returns 文件分块状态
   */
  async function ensureState(fileKey: string, config: ChunkingConfig): Promise<FileChunkingState> {
    // 如果已有状态且配置相同，直接返回
    const existing = fileStates.value.get(fileKey)
    if (
      existing &&
      existing.config.mode === config.mode &&
      existing.config.maxChars === config.maxChars
    ) {
      return existing
    }

    loadingByFileKey.value.set(fileKey, true)
    try {
      const state = await ChunkingDataSource.getFileChunkingState(fileKey, config)
      fileStates.value.set(fileKey, state)
      return state
    } finally {
      loadingByFileKey.value.set(fileKey, false)
    }
  }

  /**
   * 更新文件的分块状态（用于配置变更后重新生成）
   * @param fileKey 文件标识
   * @param config 新的分块配置
   */
  async function updateChunking(fileKey: string, config: ChunkingConfig): Promise<void> {
    await ensureState(fileKey, config)
  }

  return {
    fileStates,
    isLoading,
    getState,
    ensureState,
    updateChunking
  }
})

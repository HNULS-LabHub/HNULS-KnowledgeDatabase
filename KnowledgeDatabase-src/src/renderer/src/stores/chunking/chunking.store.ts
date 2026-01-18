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
   * 检查文件是否有分块结果
   */
  const hasChunks = computed(() => (fileKey: string, config: ChunkingConfig): boolean => {
    const state = fileStates.value.get(fileKey)
    if (!state) return false
    return (
      state.config.mode === config.mode &&
      state.config.maxChars === config.maxChars &&
      state.chunks.length > 0
    )
  })

  /**
   * 确保文件的分块状态已加载
   * @param fileKey 文件标识
   * @param config 分块配置
   * @param options 可选参数（knowledgeBaseId）
   * @returns 文件分块状态
   */
  async function ensureState(
    fileKey: string,
    config: ChunkingConfig,
    options?: { knowledgeBaseId?: number }
  ): Promise<FileChunkingState> {
    // 如果已有状态且配置相同且有分块，直接返回
    const existing = fileStates.value.get(fileKey)
    if (
      existing &&
      existing.config.mode === config.mode &&
      existing.config.maxChars === config.maxChars &&
      existing.chunks.length > 0
    ) {
      return existing
    }

    loadingByFileKey.value.set(fileKey, true)
    try {
      const state = await ChunkingDataSource.getFileChunkingState(fileKey, config, options)
      fileStates.value.set(fileKey, state)
      return state
    } finally {
      loadingByFileKey.value.set(fileKey, false)
    }
  }

  /**
   * 执行分块操作
   * 支持异步，每个文件独立实例
   * @param fileKey 文件标识
   * @param config 分块配置
   * @param options 分块选项
   * @returns 文件分块状态
   */
  async function startChunking(
    fileKey: string,
    config: ChunkingConfig,
    options: {
      knowledgeBaseId: number
      fileRelativePath: string
      parsingVersionId?: string
    }
  ): Promise<FileChunkingState> {
    // 如果正在加载，直接返回（防止重复触发）
    if (loadingByFileKey.value.get(fileKey)) {
      const existing = fileStates.value.get(fileKey)
      if (existing) return existing
    }

    loadingByFileKey.value.set(fileKey, true)
    try {
      const state = await ChunkingDataSource.chunkDocument(fileKey, config, options)
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
    hasChunks,
    ensureState,
    startChunking,
    updateChunking
  }
})

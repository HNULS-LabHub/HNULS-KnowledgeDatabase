/**
 * 嵌入状态管理 Store
 * 简化版，参照 chunking.store.ts
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { EmbeddingDataSource } from './embedding.datasource'
import type { FileEmbeddingState, EmbeddingConfig } from './embedding.types'

export const useEmbeddingStore = defineStore('embedding', () => {
  const fileStates = ref<Map<string, FileEmbeddingState>>(new Map())
  const loadingByFileKey = ref<Map<string, boolean>>(new Map())

  const isLoading = computed(
    () => (fileKey: string) => loadingByFileKey.value.get(fileKey) === true
  )

  /**
   * 获取文件的嵌入状态
   */
  const getState = computed(() => (fileKey: string): FileEmbeddingState | null => {
    return fileStates.value.get(fileKey) ?? null
  })

  /**
   * 检查文件是否有嵌入结果
   */
  const hasEmbeddings = computed(() => (fileKey: string, config: EmbeddingConfig): boolean => {
    const state = fileStates.value.get(fileKey)
    if (!state) return false
    return state.config.configId === config.configId && state.vectors.length > 0
  })

  /**
   * 确保文件的嵌入状态已加载
   * @param fileKey 文件标识
   * @param config 嵌入配置
   * @param options 可选参数（knowledgeBaseId）
   * @returns 文件嵌入状态
   */
  async function ensureState(
    fileKey: string,
    config: EmbeddingConfig,
    options?: { knowledgeBaseId?: number }
  ): Promise<FileEmbeddingState> {
    // 如果已有状态且配置相同且有向量，直接返回
    const existing = fileStates.value.get(fileKey)
    if (existing && existing.config.configId === config.configId && existing.vectors.length > 0) {
      return existing
    }

    loadingByFileKey.value.set(fileKey, true)
    try {
      const state = await EmbeddingDataSource.getFileEmbeddingState(fileKey, config, options)
      fileStates.value.set(fileKey, state)
      return state
    } finally {
      loadingByFileKey.value.set(fileKey, false)
    }
  }

  /**
   * 执行嵌入操作
   * 支持异步，每个文件独立实例
   * @param fileKey 文件标识
   * @param config 嵌入配置
   * @param options 嵌入选项
   * @param chunks 分块数据
   * @param onProgress 进度回调
   * @returns 文件嵌入状态
   */
  async function startEmbedding(
    fileKey: string,
    config: EmbeddingConfig,
    options: {
      knowledgeBaseId: number
      fileRelativePath: string
      totalChunks: number
      fileName?: string
    },
    chunks: Array<{ index: number; text: string }>,
    onProgress?: (progress: number, processed: number) => void
  ): Promise<FileEmbeddingState> {
    // 如果正在加载，直接返回（防止重复触发）
    if (loadingByFileKey.value.get(fileKey)) {
      const existing = fileStates.value.get(fileKey)
      if (existing) return existing
    }

    // 设置初始状态
    fileStates.value.set(fileKey, {
      fileKey,
      config,
      vectors: [],
      status: 'running',
      progress: 0,
      totalVectors: options.totalChunks,
      processedVectors: 0
    })

    loadingByFileKey.value.set(fileKey, true)
    try {
      const state = await EmbeddingDataSource.startEmbedding(
        fileKey,
        config,
        options,
        chunks,
        (progress, processed) => {
          // 更新进度
          const currentState = fileStates.value.get(fileKey)
          if (currentState) {
            fileStates.value.set(fileKey, {
              ...currentState,
              progress,
              processedVectors: processed,
              status: 'running'
            })
          }
          // 调用外部进度回调
          if (onProgress) {
            onProgress(progress, processed)
          }
        }
      )
      fileStates.value.set(fileKey, state)
      return state
    } catch (error) {
      // 更新为失败状态
      const currentState = fileStates.value.get(fileKey)
      if (currentState) {
        fileStates.value.set(fileKey, {
          ...currentState,
          status: 'failed',
          error: error instanceof Error ? error.message : '嵌入失败'
        })
      }
      throw error
    } finally {
      loadingByFileKey.value.set(fileKey, false)
    }
  }

  return {
    fileStates,
    isLoading,
    getState,
    hasEmbeddings,
    ensureState,
    startEmbedding
  }
})

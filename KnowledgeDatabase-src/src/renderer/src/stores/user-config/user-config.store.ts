import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UserConfig } from '@preload/types'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export const useUserConfigStore = defineStore('user-config', () => {
  const config = ref<UserConfig | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const saveStatus = ref<SaveStatus>('idle')
  const saveError = ref<string | null>(null)

  async function fetch(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const res = await window.api.userConfig.get()
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to load user config')
      }
      config.value = res.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load user config'
      config.value = null
    } finally {
      loading.value = false
    }
  }

  async function update(patch: Partial<UserConfig>): Promise<void> {
    saveStatus.value = 'saving'
    saveError.value = null
    try {
      const res = await window.api.userConfig.update(patch)
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to save user config')
      }
      config.value = res.data
      saveStatus.value = 'saved'
      setTimeout(() => {
        if (saveStatus.value === 'saved') saveStatus.value = 'idle'
      }, 1200)
    } catch (e) {
      saveStatus.value = 'error'
      saveError.value = e instanceof Error ? e.message : 'Failed to save user config'
      throw e
    }
  }

  async function updateMinerUApiKey(apiKey: string): Promise<void> {
    await update({
      minerU: {
        apiKey
      }
    })
  }

  async function updateEmbeddingConcurrency(concurrency: number): Promise<void> {
    await update({
      embedding: {
        ...config.value?.embedding,
        concurrency
      }
    })
  }

  async function updateHnswBatchSize(hnswBatchSize: number): Promise<void> {
    await update({
      embedding: {
        ...config.value?.embedding,
        hnswBatchSize
      }
    })
  }

  async function updateKgChunkConcurrency(chunkConcurrency: number): Promise<void> {
    await update({
      knowledgeGraph: {
        ...config.value?.knowledgeGraph,
        chunkConcurrency
      }
    })
  }

  return {
    config,
    loading,
    error,
    saveStatus,
    saveError,
    fetch,
    update,
    updateMinerUApiKey,
    updateEmbeddingConcurrency,
    updateHnswBatchSize,
    updateKgChunkConcurrency
  }
})

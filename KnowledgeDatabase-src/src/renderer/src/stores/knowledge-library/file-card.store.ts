import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useFileDataStore } from './file-data.store'
import type { FileNode } from './file.types'

/**
 * 文件卡片 Store（卡片视图）
 * 只做视图层逻辑，数据来源统一由 FileDataStore 提供
 */
export const useFileCardStore = defineStore('file-card', () => {
  const fileDataStore = useFileDataStore()

  // 视图状态
  const searchQuery = ref('')
  const statusFilter = ref<(file: FileNode) => boolean>(() => true)

  // Getters
  const filteredFiles = computed(() => {
    const base = searchQuery.value.trim()
      ? fileDataStore.files.filter((file) =>
          file.name.toLowerCase().includes(searchQuery.value.toLowerCase())
        )
      : fileDataStore.files
    return base.filter((file) => statusFilter.value(file))
  })

  // Actions（委托到 FileDataStore）
  async function fetchFiles(knowledgeBaseId: number): Promise<void> {
    await fileDataStore.fetchFiles(knowledgeBaseId)
  }

  function setSearchQuery(query: string): void {
    searchQuery.value = query
  }

  function setStatusFilter(predicate: (file: FileNode) => boolean): void {
    statusFilter.value = predicate
  }

  function resetStatusFilter(): void {
    statusFilter.value = () => true
  }

  async function refresh(): Promise<void> {
    await fileDataStore.refresh()
  }

  return {
    // State
    searchQuery,
    // Getters
    filteredFiles,
    loading: computed(() => fileDataStore.loading),
    error: computed(() => fileDataStore.error),
    // Actions
    fetchFiles,
    setSearchQuery,
    setStatusFilter,
    resetStatusFilter,
    refresh
  }
})

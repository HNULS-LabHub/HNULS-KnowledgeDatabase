import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { FileDataSource } from './file.datasource'
import type { FileNode } from './file.types'

/**
 * 文件卡片 Store（卡片视图）
 */
export const useFileCardStore = defineStore('file-card', () => {
  // State
  const files = ref<FileNode[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentKnowledgeBaseId = ref<number | null>(null)
  const searchQuery = ref('')
  const statusFilter = ref<(file: FileNode) => boolean>(() => true)

  // Getters
  const filteredFiles = computed(() => {
    const bySearch = searchQuery.value.trim()
      ? files.value.filter((file) => file.name.toLowerCase().includes(searchQuery.value.toLowerCase()))
      : files.value
    return bySearch.filter((file) => statusFilter.value(file))
  })

  // Actions
  /**
   * 获取文件列表
   */
  async function fetchFiles(knowledgeBaseId: number): Promise<void> {
    loading.value = true
    error.value = null
    currentKnowledgeBaseId.value = knowledgeBaseId

    try {
      files.value = await FileDataSource.getAll(knowledgeBaseId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch files'
      console.error('Failed to fetch files:', err)
      files.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * 设置搜索查询
   */
  function setSearchQuery(query: string): void {
    searchQuery.value = query
  }

  /**
   * 设置状态筛选器
   */
  function setStatusFilter(predicate: (file: FileNode) => boolean): void {
    statusFilter.value = predicate
  }

  /**
   * 重置状态筛选器
   */
  function resetStatusFilter(): void {
    statusFilter.value = () => true
  }

  /**
   * 刷新数据
   */
  async function refresh(): Promise<void> {
    if (currentKnowledgeBaseId.value !== null) {
      await fetchFiles(currentKnowledgeBaseId.value)
    }
  }

  return {
    // State
    files,
    loading,
    error,
    searchQuery,
    // Getters
    filteredFiles,
    // Actions
    fetchFiles,
    setSearchQuery,
    setStatusFilter,
    resetStatusFilter,
    refresh
  }
})

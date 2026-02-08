import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { FileDataSource } from './file.datasource'
import type { FileNode } from './file.types'

/**
 * 文件列表 Store（列表视图）
 */
export const useFileListStore = defineStore('file-list', () => {
  // State
  const files = ref<FileNode[]>([])
  const statusFilter = ref<(file: FileNode) => boolean>(() => true)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentPage = ref(1)
  const pageSize = ref(20)
  const currentKnowledgeBaseId = ref<number | null>(null)

  // Getters
  const totalFiles = computed(() => files.value.length)
  const totalPages = computed(() => Math.ceil(totalFiles.value / pageSize.value))
  const startIndex = computed(() => (currentPage.value - 1) * pageSize.value)
  const endIndex = computed(() => Math.min(startIndex.value + pageSize.value, totalFiles.value))

  const filteredFiles = computed(() => files.value.filter((f) => statusFilter.value(f)))

  const paginatedFiles = computed(() => {
    return filteredFiles.value.slice(startIndex.value, endIndex.value)
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
      // 重置到第一页
      currentPage.value = 1
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch files'
      console.error('Failed to fetch files:', err)
      files.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * 跳转到指定页
   */
  function goToPage(page: number): void {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page
    }
  }

  /**
   * 设置每页数量
   */
  function setPageSize(size: number): void {
    pageSize.value = size
    currentPage.value = 1 // 重置到第一页
  }

  /**
   * 设置状态筛选器
   */
  function setStatusFilter(predicate: (file: FileNode) => boolean): void {
    statusFilter.value = predicate
    currentPage.value = 1
  }

  /**
   * 重置筛选器
   */
  function resetStatusFilter(): void {
    statusFilter.value = () => true
    currentPage.value = 1
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
    currentPage,
    pageSize,
    // Getters
    totalFiles,
    totalPages,
    startIndex,
    endIndex,
    filteredFiles,
    paginatedFiles,
    // Actions
    fetchFiles,
    goToPage,
    setPageSize,
    refresh,
    setStatusFilter,
    resetStatusFilter
  }
})

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useFileDataStore } from './file-data.store'
import type { FileNode } from './file.types'

/**
 * 文件列表 Store（列表视图）
 * 只做视图层逻辑，数据来源统一由 FileDataStore 提供
 */
export const useFileListStore = defineStore('file-list', () => {
  const fileDataStore = useFileDataStore()

  // 视图状态
  const statusFilter = ref<(file: FileNode) => boolean>(() => true)
  const currentPage = ref(1)
  const pageSize = ref(20)

  // Getters
  const totalFiles = computed(() => fileDataStore.files.length)
  const totalPages = computed(() => Math.ceil(totalFiles.value / pageSize.value))
  const startIndex = computed(() => (currentPage.value - 1) * pageSize.value)
  const endIndex = computed(() => Math.min(startIndex.value + pageSize.value, totalFiles.value))

  const filteredFiles = computed(() =>
    fileDataStore.files.filter((f) => statusFilter.value(f))
  )

  const paginatedFiles = computed(() => {
    return filteredFiles.value.slice(startIndex.value, endIndex.value)
  })

  // Actions
  // 仍保留 fetch 接口以兼容调用方，但实际委托给 FileDataStore
  async function fetchFiles(knowledgeBaseId: number): Promise<void> {
    await fileDataStore.fetchFiles(knowledgeBaseId)
  }

  function goToPage(page: number): void {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page
    }
  }

  function setPageSize(size: number): void {
    pageSize.value = size
    currentPage.value = 1
  }

  function setStatusFilter(predicate: (file: FileNode) => boolean): void {
    statusFilter.value = predicate
    currentPage.value = 1
  }

  function resetStatusFilter(): void {
    statusFilter.value = () => true
    currentPage.value = 1
  }

  async function refresh(): Promise<void> {
    await fileDataStore.refresh()
  }

  return {
    // State
    currentPage,
    pageSize,
    // Getters
    totalFiles,
    totalPages,
    startIndex,
    endIndex,
    filteredFiles,
    paginatedFiles,
    loading: computed(() => fileDataStore.loading),
    error: computed(() => fileDataStore.error),
    // Actions
    fetchFiles,
    goToPage,
    setPageSize,
    refresh,
    setStatusFilter,
    resetStatusFilter
  }
})

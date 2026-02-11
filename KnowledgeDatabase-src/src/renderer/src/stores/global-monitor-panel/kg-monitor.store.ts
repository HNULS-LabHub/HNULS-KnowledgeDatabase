import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { KgMonitorDataSource } from './kg-monitor.datasource'
import type { KgTaskRecord, KgTaskStatus, KgTaskSortBy, KgSortDir, KgChunkState } from './kg-monitor.types'

const TASK_STATUSES: Array<KgTaskStatus | 'all'> = [
  'all',
  'pending',
  'progressing',
  'completed',
  'failed'
]

const DEFAULT_PAGE_SIZE = 20

export const useKgMonitorStore = defineStore('kg-monitor', () => {
  const tasks = ref<KgTaskRecord[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const statusFilter = ref<KgTaskStatus | 'all'>('all')
  const fileKeyFilter = ref('')
  const sortBy = ref<KgTaskSortBy>('updatedAt')
  const sortDir = ref<KgSortDir>('desc')

  const page = ref(1)
  const pageSize = ref(DEFAULT_PAGE_SIZE)

  const expandedTaskId = ref<string | null>(null)
  const chunkStateByTask = ref<Map<string, KgChunkState>>(new Map())

  const pageCount = computed(() =>
    Math.max(1, Math.ceil(total.value / Math.max(1, pageSize.value)))
  )

  const statusOptions = computed(() => TASK_STATUSES)

  function updateChunkState(taskId: string, next: KgChunkState): void {
    const nextMap = new Map(chunkStateByTask.value)
    nextMap.set(taskId, next)
    chunkStateByTask.value = nextMap
  }

  function getChunkState(taskId: string): KgChunkState | null {
    return chunkStateByTask.value.get(taskId) ?? null
  }

  async function fetchTasks(): Promise<void> {
    loading.value = true
    try {
      const result = await KgMonitorDataSource.getTasks({
        page: page.value,
        pageSize: pageSize.value,
        status: statusFilter.value,
        fileKey: fileKeyFilter.value.trim(),
        sortBy: sortBy.value,
        sortDir: sortDir.value
      })
      tasks.value = result.items
      total.value = result.total
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载知识图谱任务失败'
    } finally {
      loading.value = false
    }
  }

  async function fetchChunks(taskId: string): Promise<void> {
    const current =
      chunkStateByTask.value.get(taskId) ??
      ({
        items: [],
        total: 0,
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        loading: false
      } as KgChunkState)

    updateChunkState(taskId, { ...current, loading: true })
    try {
      const result = await KgMonitorDataSource.getTaskChunks({
        taskId,
        page: current.page,
        pageSize: current.pageSize
      })
      updateChunkState(taskId, {
        ...current,
        items: result.items,
        total: result.total,
        loading: false
      })
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载分块失败'
      updateChunkState(taskId, { ...current, loading: false })
    }
  }

  async function setPage(next: number): Promise<void> {
    const safePage = Math.min(Math.max(1, next), pageCount.value)
    page.value = safePage
    await fetchTasks()
  }

  async function setPageSize(next: number): Promise<void> {
    pageSize.value = next
    page.value = 1
    await fetchTasks()
  }

  async function setStatusFilter(next: KgTaskStatus | 'all'): Promise<void> {
    statusFilter.value = next
    page.value = 1
    await fetchTasks()
  }

  async function setFileKeyFilter(next: string): Promise<void> {
    fileKeyFilter.value = next
    page.value = 1
    await fetchTasks()
  }

  async function setSort(next: KgTaskSortBy): Promise<void> {
    if (sortBy.value === next) {
      sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortBy.value = next
      sortDir.value = 'desc'
    }
    await fetchTasks()
  }

  async function toggleExpand(taskId: string): Promise<void> {
    if (expandedTaskId.value === taskId) {
      expandedTaskId.value = null
      return
    }
    expandedTaskId.value = taskId
    await fetchChunks(taskId)
  }

  async function setChunkPage(taskId: string, next: number): Promise<void> {
    const current = getChunkState(taskId)
    if (!current) return
    const maxPage = Math.max(1, Math.ceil(current.total / Math.max(1, current.pageSize)))
    const safePage = Math.min(Math.max(1, next), maxPage)
    updateChunkState(taskId, { ...current, page: safePage })
    await fetchChunks(taskId)
  }

  async function setChunkPageSize(taskId: string, next: number): Promise<void> {
    const current = getChunkState(taskId)
    if (!current) return
    updateChunkState(taskId, { ...current, pageSize: next, page: 1 })
    await fetchChunks(taskId)
  }

  async function cancelTask(taskId: string): Promise<void> {
    await KgMonitorDataSource.cancelTask(taskId)
    await fetchTasks()
    if (expandedTaskId.value === taskId) {
      await fetchChunks(taskId)
    }
  }

  async function retryTask(taskId: string): Promise<void> {
    await KgMonitorDataSource.retryTask(taskId)
    await fetchTasks()
    if (expandedTaskId.value === taskId) {
      await fetchChunks(taskId)
    }
  }

  async function removeTask(taskId: string): Promise<void> {
    await KgMonitorDataSource.removeTask(taskId)
    if (expandedTaskId.value === taskId) {
      expandedTaskId.value = null
    }
    await fetchTasks()
  }

  return {
    tasks,
    total,
    loading,
    error,
    statusFilter,
    fileKeyFilter,
    sortBy,
    sortDir,
    page,
    pageSize,
    pageCount,
    statusOptions,
    expandedTaskId,
    getChunkState,
    fetchTasks,
    toggleExpand,
    setPage,
    setPageSize,
    setStatusFilter,
    setFileKeyFilter,
    setSort,
    setChunkPage,
    setChunkPageSize,
    cancelTask,
    retryTask,
    removeTask
  }
})

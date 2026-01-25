/**
 * 任务监控 Pinia Store
 * 纯订阅/缓存层 - 从全局监控服务获取任务状态
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TaskRecord, TaskStatus } from '@preload/types'

// 任务状态列表
const TASK_STATUSES: Array<TaskStatus | 'all'> = [
  'all',
  'pending',
  'running',
  'paused',
  'completed',
  'failed'
]

export const useTaskMonitorStore = defineStore('taskMonitor', () => {
  // ========== State ==========
  const tasksById = ref<Map<string, TaskRecord>>(new Map())
  const loading = ref(false)
  const error = ref<string | null>(null)
  const listenerInited = ref(false)

  // 筛选条件
  const searchQuery = ref('')
  const statusFilter = ref<TaskStatus | 'all'>('all')
  const typeFilter = ref<string | 'all'>('all')

  // 选中的任务 ID
  const selectedTaskIds = ref<Set<string>>(new Set())

  // ========== Getters ==========

  /**
   * 任务列表（按创建时间降序）
   */
  const tasks = computed(() =>
    [...tasksById.value.values()].sort((a, b) => b.createdAt - a.createdAt)
  )

  /**
   * 过滤后的任务列表
   */
  const filteredTasks = computed(() => {
    return tasks.value.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        task.id.toLowerCase().includes(searchQuery.value.toLowerCase())

      const matchesStatus = statusFilter.value === 'all' || task.status === statusFilter.value

      const matchesType = typeFilter.value === 'all' || task.type === typeFilter.value

      return matchesSearch && matchesStatus && matchesType
    })
  })

  /**
   * 是否全选
   */
  const isAllSelected = computed(() => {
    return (
      filteredTasks.value.length > 0 && selectedTaskIds.value.size === filteredTasks.value.length
    )
  })

  /**
   * 选中的任务数量
   */
  const selectedCount = computed(() => selectedTaskIds.value.size)

  /**
   * 任务类型列表（动态从现有任务中提取）
   */
  const taskTypes = computed(() => ['all', ...new Set(tasks.value.map((t) => t.type))])

  /**
   * 任务状态列表
   */
  const taskStatuses = computed(() => TASK_STATUSES)

  /**
   * 是否有活跃任务
   */
  const hasActiveTasks = computed(() =>
    tasks.value.some((t) => t.status === 'running' || t.status === 'pending')
  )

  /**
   * 活跃任务数量
   */
  const activeTaskCount = computed(
    () => tasks.value.filter((t) => t.status === 'running' || t.status === 'pending').length
  )

  // ========== Actions ==========

  /**
   * 初始化：加载任务列表并订阅变更
   */
  async function init() {
    if (listenerInited.value) return
    listenerInited.value = true
    loading.value = true

    try {
      const taskList = await window.api.taskMonitor.getTasks()
      tasksById.value = new Map(taskList.map((t) => [t.id, t]))

      window.api.taskMonitor.onTaskChanged((list) => {
        tasksById.value = new Map(list.map((t) => [t.id, t]))
      })

      console.log('[TaskMonitor] Store initialized, tasks:', taskList.length)
    } catch (err) {
      error.value = err instanceof Error ? err.message : '初始化任务监控失败'
      console.error('[TaskMonitor] Failed to init:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 刷新任务列表
   */
  async function refresh() {
    loading.value = true
    try {
      const taskList = await window.api.taskMonitor.getTasks()
      tasksById.value = new Map(taskList.map((t) => [t.id, t]))
      console.log('[TaskMonitor] Refreshed, tasks:', taskList.length)
    } catch (err) {
      error.value = err instanceof Error ? err.message : '刷新任务列表失败'
      console.error('[TaskMonitor] Failed to refresh:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 设置搜索关键词
   */
  function setSearchQuery(query: string) {
    searchQuery.value = query
  }

  /**
   * 设置状态筛选
   */
  function setStatusFilter(status: TaskStatus | 'all') {
    statusFilter.value = status
  }

  /**
   * 设置类型筛选
   */
  function setTypeFilter(type: string | 'all') {
    typeFilter.value = type
  }

  /**
   * 清除所有筛选条件
   */
  function clearFilters() {
    searchQuery.value = ''
    statusFilter.value = 'all'
    typeFilter.value = 'all'
  }

  /**
   * 切换单个任务选中状态
   */
  function toggleTaskSelection(taskId: string) {
    const newSelected = new Set(selectedTaskIds.value)
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId)
    } else {
      newSelected.add(taskId)
    }
    selectedTaskIds.value = newSelected
  }

  /**
   * 切换全选
   */
  function toggleSelectAll() {
    if (isAllSelected.value) {
      selectedTaskIds.value = new Set()
    } else {
      selectedTaskIds.value = new Set(filteredTasks.value.map((t) => t.id))
    }
  }

  /**
   * 清除选择
   */
  function clearSelection() {
    selectedTaskIds.value = new Set()
  }

  /**
   * 批量暂停任务
   */
  async function batchPauseTasks() {
    if (selectedTaskIds.value.size === 0) return

    loading.value = true
    try {
      const taskIds = Array.from(selectedTaskIds.value)
      await window.api.taskMonitor.batchPause(taskIds)
      clearSelection()
    } catch (err) {
      error.value = err instanceof Error ? err.message : '批量暂停任务失败'
      console.error('[TaskMonitor] Failed to batch pause tasks:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 批量恢复任务
   */
  async function batchResumeTasks() {
    if (selectedTaskIds.value.size === 0) return

    loading.value = true
    try {
      const taskIds = Array.from(selectedTaskIds.value)
      await window.api.taskMonitor.batchResume(taskIds)
      clearSelection()
    } catch (err) {
      error.value = err instanceof Error ? err.message : '批量恢复任务失败'
      console.error('[TaskMonitor] Failed to batch resume tasks:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 移除任务
   */
  async function removeTask(taskId: string) {
    try {
      await window.api.taskMonitor.removeTask(taskId)
      tasksById.value.delete(taskId)
      selectedTaskIds.value.delete(taskId)
      console.log('[TaskMonitor] Removed task', { taskId })
    } catch (err) {
      error.value = err instanceof Error ? err.message : '移除任务失败'
      console.error('[TaskMonitor] Failed to remove task:', err)
    }
  }

  /**
   * 清除已完成的任务
   */
  async function clearCompletedTasks() {
    loading.value = true
    try {
      const count = await window.api.taskMonitor.clearTasks({ status: ['completed', 'failed'] })
      console.log('[TaskMonitor] Cleared completed tasks', { count })
    } catch (err) {
      error.value = err instanceof Error ? err.message : '清除已完成任务失败'
      console.error('[TaskMonitor] Failed to clear completed tasks:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 根据 ID 获取任务
   */
  function getTaskById(taskId: string): TaskRecord | undefined {
    return tasksById.value.get(taskId)
  }

  return {
    // State
    tasks,
    loading,
    error,
    searchQuery,
    statusFilter,
    typeFilter,
    selectedTaskIds,

    // Getters
    filteredTasks,
    isAllSelected,
    selectedCount,
    taskTypes,
    taskStatuses,
    hasActiveTasks,
    activeTaskCount,

    // Actions
    init,
    refresh,
    setSearchQuery,
    setStatusFilter,
    setTypeFilter,
    clearFilters,
    toggleTaskSelection,
    toggleSelectAll,
    clearSelection,
    batchPauseTasks,
    batchResumeTasks,
    removeTask,
    clearCompletedTasks,
    getTaskById
  }
})

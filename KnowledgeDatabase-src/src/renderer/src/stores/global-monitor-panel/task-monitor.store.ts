/**
 * 任务监控 Pinia Store
 * 单一事实来源（SSOT）
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Task, TaskFilter, TaskStatus, TaskType } from './task-monitor.types'
import { TaskMonitorDataSource } from './task-monitor.datasource'
import { TASK_TYPES, TASK_STATUSES } from './task-monitor.mock'

export const useTaskMonitorStore = defineStore('taskMonitor', () => {
  // ========== State ==========
  const tasks = ref<Task[]>([]) // 不使用 Mock 数据，仅存储真实任务
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 筛选条件
  const filter = ref<TaskFilter>({
    searchQuery: '',
    statusFilter: 'All Status',
    typeFilter: 'All Types'
  })

  // 选中的任务 ID
  const selectedTaskIds = ref<Set<string>>(new Set())

  // ========== Getters ==========

  /**
   * 过滤后的任务列表
   */
  const filteredTasks = computed(() => {
    return tasks.value.filter((task) => {
      const matchesSearch =
        task.name.toLowerCase().includes(filter.value.searchQuery.toLowerCase()) ||
        task.id.toLowerCase().includes(filter.value.searchQuery.toLowerCase())

      const matchesStatus =
        filter.value.statusFilter === 'All Status' || task.status === filter.value.statusFilter

      const matchesType =
        filter.value.typeFilter === 'All Types' || task.type === filter.value.typeFilter

      return matchesSearch && matchesStatus && matchesType
    })
  })

  /**
   * 是否全选
   */
  const isAllSelected = computed(() => {
    return filteredTasks.value.length > 0 && selectedTaskIds.value.size === filteredTasks.value.length
  })

  /**
   * 选中的任务数量
   */
  const selectedCount = computed(() => selectedTaskIds.value.size)

  /**
   * 任务类型列表
   */
  const taskTypes = computed(() => TASK_TYPES)

  /**
   * 任务状态列表
   */
  const taskStatuses = computed(() => TASK_STATUSES)

  // ========== Actions ==========

  /**
   * 加载任务列表
   */
  async function loadTasks() {
    // 文件导入任务仅存在于内存中，不需要从后端加载
    // 任务通过 addFileImportTask 动态添加
    loading.value = false
  }

  /**
   * 刷新任务列表
   */
  async function refreshTasks() {
    // 文件导入任务仅存在于内存中，无需刷新
    // 如果将来需要从后端加载其他类型的任务，可以在这里实现
    console.log('[TaskMonitor] Refresh called, current tasks:', tasks.value.length)
  }

  /**
   * 设置搜索关键词
   */
  function setSearchQuery(query: string) {
    filter.value.searchQuery = query
  }

  /**
   * 设置状态筛选
   */
  function setStatusFilter(status: TaskStatus | 'All Status') {
    filter.value.statusFilter = status
  }

  /**
   * 设置类型筛选
   */
  function setTypeFilter(type: TaskType | 'All Types') {
    filter.value.typeFilter = type
  }

  /**
   * 清除所有筛选条件
   */
  function clearFilters() {
    filter.value = {
      searchQuery: '',
      statusFilter: 'All Status',
      typeFilter: 'All Types'
    }
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
   * 批量停止任务
   */
  async function batchStopTasks() {
    if (selectedTaskIds.value.size === 0) return

    loading.value = true
    try {
      const taskIds = Array.from(selectedTaskIds.value)
      await TaskMonitorDataSource.batchStopTasks(taskIds)
      // 重新加载任务列表
      await loadTasks()
      clearSelection()
    } catch (err) {
      error.value = err instanceof Error ? err.message : '批量停止任务失败'
      console.error('[TaskMonitor] Failed to batch stop tasks:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 批量重新运行任务
   */
  async function batchRestartTasks() {
    if (selectedTaskIds.value.size === 0) return

    loading.value = true
    try {
      const taskIds = Array.from(selectedTaskIds.value)
      await TaskMonitorDataSource.batchRestartTasks(taskIds)
      // 重新加载任务列表
      await loadTasks()
      clearSelection()
    } catch (err) {
      error.value = err instanceof Error ? err.message : '批量重新运行任务失败'
      console.error('[TaskMonitor] Failed to batch restart tasks:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 导出报表
   */
  async function exportReport() {
    loading.value = true
    try {
      await TaskMonitorDataSource.exportReport()
    } catch (err) {
      error.value = err instanceof Error ? err.message : '导出报表失败'
      console.error('[TaskMonitor] Failed to export report:', err)
    } finally {
      loading.value = false
    }
  }

  // ========== 文件导入任务管理 ==========

  /**
   * 添加文件导入任务
   */
  function addFileImportTask(
    taskId: string,
    knowledgeBaseId: number,
    knowledgeBaseName: string,
    fileCount: number
  ) {
    const task: Task = {
      id: taskId,
      name: `文件导入: ${knowledgeBaseName}`,
      type: 'File Import',
      status: 'pending',
      progress: 0,
      owner: 'System',
      started: '刚刚',
      knowledgeBaseId,
      knowledgeBaseName,
      importDetail: {
        percentage: 0,
        processed: 0,
        totalFiles: fileCount,
        imported: 0,
        failed: 0,
        currentFile: ''
      }
    }
    tasks.value.push(task)
    console.log('[TaskMonitor] Added file import task', { taskId, knowledgeBaseId, knowledgeBaseName })
  }

  /**
   * 更新文件导入进度
   */
  function updateFileImportProgress(progressData: {
    taskId: string
    percentage: number
    processed: number
    totalFiles: number
    imported: number
    failed: number
    currentFile: string
  }) {
    const task = tasks.value.find((t) => t.id === progressData.taskId)
    if (task) {
      task.status = 'running'
      task.progress = progressData.percentage
      task.importDetail = {
        percentage: progressData.percentage,
        processed: progressData.processed,
        totalFiles: progressData.totalFiles,
        imported: progressData.imported,
        failed: progressData.failed,
        currentFile: progressData.currentFile
      }
      console.log('[TaskMonitor] Updated file import progress', { taskId: progressData.taskId, progress: progressData.percentage })
    } else {
      console.warn('[TaskMonitor] Task not found for progress update', { taskId: progressData.taskId })
    }
  }

  /**
   * 完成文件导入任务
   */
  function completeFileImportTask(taskId: string, result: { imported: number; failed: number }) {
    const task = tasks.value.find((t) => t.id === taskId)
    if (task) {
      task.status = 'completed'
      task.progress = 100
      if (task.importDetail) {
        task.importDetail.imported = result.imported
        task.importDetail.failed = result.failed
        task.importDetail.percentage = 100
      }
      console.log('[TaskMonitor] File import task completed', { taskId, result })
    } else {
      console.warn('[TaskMonitor] Task not found for completion', { taskId })
    }
  }

  /**
   * 文件导入任务失败
   */
  function failFileImportTask(taskId: string, errorMessage: string) {
    const task = tasks.value.find((t) => t.id === taskId)
    if (task) {
      task.status = 'failed'
      task.name = `${task.name} (失败: ${errorMessage})`
      console.log('[TaskMonitor] File import task failed', { taskId, error: errorMessage })
    } else {
      console.warn('[TaskMonitor] Task not found for failure', { taskId })
    }
  }

  /**
   * 移除任务
   */
  function removeTask(taskId: string) {
    const index = tasks.value.findIndex((t) => t.id === taskId)
    if (index !== -1) {
      tasks.value.splice(index, 1)
      console.log('[TaskMonitor] Removed task', { taskId })
    }
  }

  /**
   * 清除已完成的任务
   */
  function clearCompletedTasks() {
    const beforeCount = tasks.value.length
    tasks.value = tasks.value.filter((t) => t.status !== 'completed' && t.status !== 'failed')
    const removedCount = beforeCount - tasks.value.length
    console.log('[TaskMonitor] Cleared completed tasks', { count: removedCount })
  }

  return {
    // State
    tasks,
    loading,
    error,
    filter,
    selectedTaskIds,

    // Getters
    filteredTasks,
    isAllSelected,
    selectedCount,
    taskTypes,
    taskStatuses,

    // Actions
    loadTasks,
    refreshTasks,
    setSearchQuery,
    setStatusFilter,
    setTypeFilter,
    clearFilters,
    toggleTaskSelection,
    toggleSelectAll,
    clearSelection,
    batchStopTasks,
    batchRestartTasks,
    exportReport,

    // 文件导入任务管理
    addFileImportTask,
    updateFileImportProgress,
    completeFileImportTask,
    failFileImportTask,
    removeTask,
    clearCompletedTasks
  }
})

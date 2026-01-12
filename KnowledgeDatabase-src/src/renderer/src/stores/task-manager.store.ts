import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// 使用 window.api 的类型定义
type ImportProgress = Parameters<Parameters<typeof window.api.fileImport.onProgress>[0]>[0]
type ImportResult = Awaited<ReturnType<typeof window.api.fileImport.import>>

export interface ImportTask {
  taskId: string
  knowledgeBaseId: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: ImportProgress | null
  result: ImportResult | null
  error: string | null
  startTime: number
  endTime: number | null
}

/**
 * 任务管理器 Store
 * 跟踪所有后台任务（文件导入等）
 */
export const useTaskManagerStore = defineStore('taskManager', () => {
  const importTasks = ref<Map<string, ImportTask>>(new Map())

  // 计算属性
  const activeImportTasks = computed(() => {
    return Array.from(importTasks.value.values()).filter(
      (task) => task.status === 'pending' || task.status === 'running'
    )
  })

  const allImportTasks = computed(() => {
    return Array.from(importTasks.value.values()).sort((a, b) => b.startTime - a.startTime)
  })

  const hasActiveTasks = computed(() => {
    return activeImportTasks.value.length > 0
  })

  // Actions
  function addImportTask(taskId: string, knowledgeBaseId: number) {
    const task: ImportTask = {
      taskId,
      knowledgeBaseId,
      status: 'pending',
      progress: null,
      result: null,
      error: null,
      startTime: Date.now(),
      endTime: null
    }
    importTasks.value.set(taskId, task)
    console.log('[TaskManager] Added import task', { taskId, knowledgeBaseId })
  }

  function updateImportProgress(progress: ImportProgress) {
    const task = importTasks.value.get(progress.taskId)
    if (task) {
      task.status = 'running'
      task.progress = progress
      console.log('[TaskManager] Updated import progress', { taskId: progress.taskId, progress })
    } else {
      console.warn('[TaskManager] Task not found for progress update', { taskId: progress.taskId })
    }
  }

  function completeImportTask(taskId: string, result: ImportResult) {
    const task = importTasks.value.get(taskId)
    if (task) {
      task.status = 'completed'
      task.result = result
      task.endTime = Date.now()
      console.log('[TaskManager] Import task completed', { taskId, result })
    } else {
      console.warn('[TaskManager] Task not found for completion', { taskId })
    }
  }

  function failImportTask(taskId: string, error: string) {
    const task = importTasks.value.get(taskId)
    if (task) {
      task.status = 'failed'
      task.error = error
      task.endTime = Date.now()
      console.log('[TaskManager] Import task failed', { taskId, error })
    } else {
      console.warn('[TaskManager] Task not found for failure', { taskId })
    }
  }

  function removeTask(taskId: string) {
    importTasks.value.delete(taskId)
    console.log('[TaskManager] Removed task', { taskId })
  }

  function clearCompletedTasks() {
    const toRemove: string[] = []
    importTasks.value.forEach((task, taskId) => {
      if (task.status === 'completed' || task.status === 'failed') {
        toRemove.push(taskId)
      }
    })
    toRemove.forEach((taskId) => importTasks.value.delete(taskId))
    console.log('[TaskManager] Cleared completed tasks', { count: toRemove.length })
  }

  return {
    // State
    importTasks,
    // Computed
    activeImportTasks,
    allImportTasks,
    hasActiveTasks,
    // Actions
    addImportTask,
    updateImportProgress,
    completeImportTask,
    failImportTask,
    removeTask,
    clearCompletedTasks
  }
})

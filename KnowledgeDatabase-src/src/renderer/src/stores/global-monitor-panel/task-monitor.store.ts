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

  // ========== 文档解析任务管理 ==========

  /**
   * 添加文档解析任务
   * 任务名称格式：知识库名-文档名-文档解析
   */
  function addDocumentParsingTask(
    fileKey: string,
    fileName: string,
    knowledgeBaseId: number,
    knowledgeBaseName: string,
    versionId: string,
    batchId: string
  ) {
    // 检查是否已存在相同的任务
    const existingTask = tasks.value.find(
      (t) => t.type === 'Document Parsing' && t.fileKey === fileKey && t.parsingDetail?.versionId === versionId
    )
    if (existingTask) {
      console.log('[TaskMonitor] Document parsing task already exists', { fileKey, versionId })
      return existingTask.id
    }

    const taskId = `parsing-${fileKey}-${versionId}-${Date.now()}`
    const task: Task = {
      id: taskId,
      name: `${knowledgeBaseName}-${fileName}-文档解析`,
      type: 'Document Parsing',
      status: 'running',
      progress: 0,
      owner: 'System',
      started: '刚刚',
      knowledgeBaseId,
      knowledgeBaseName,
      fileKey,
      fileName,
      parsingDetail: {
        percentage: 0,
        state: 'pending',
        versionId,
        batchId
      }
    }
    tasks.value.push(task)
    console.log('[TaskMonitor] Added document parsing task', { taskId, fileKey, fileName, knowledgeBaseName })
    return taskId
  }

  /**
   * 更新文档解析进度（由 MinerU 进度事件触发）
   */
  function updateDocumentParsingProgress(progressData: {
    fileKey: string
    versionId: string
    batchId: string
    state: string
    progress?: number
    extractedPages?: number
    totalPages?: number
  }) {
    const task = tasks.value.find(
      (t) => 
        t.type === 'Document Parsing' && 
        t.fileKey === progressData.fileKey && 
        t.parsingDetail?.versionId === progressData.versionId
    )
    
    if (task && task.parsingDetail) {
      // 更新状态
      task.status = progressData.state === 'done' ? 'completed' 
                  : progressData.state === 'failed' ? 'failed' 
                  : 'running'
      
      // 更新进度
      task.progress = progressData.progress ?? 0
      
      // 更新详情
      task.parsingDetail.percentage = progressData.progress ?? 0
      task.parsingDetail.state = progressData.state
      task.parsingDetail.extractedPages = progressData.extractedPages
      task.parsingDetail.totalPages = progressData.totalPages
      
      // 更新当前详情文本
      if (progressData.extractedPages !== undefined && progressData.totalPages !== undefined) {
        task.parsingDetail.currentDetail = `${progressData.extractedPages}/${progressData.totalPages} 页`
      } else {
        task.parsingDetail.currentDetail = progressData.state
      }
      
      console.log('[TaskMonitor] Updated document parsing progress', { 
        fileKey: progressData.fileKey, 
        progress: progressData.progress,
        state: progressData.state
      })
    } else {
      console.warn('[TaskMonitor] Document parsing task not found for progress update', { 
        fileKey: progressData.fileKey,
        versionId: progressData.versionId
      })
    }
  }

  /**
   * 完成文档解析任务
   */
  function completeDocumentParsingTask(fileKey: string, versionId: string) {
    const task = tasks.value.find(
      (t) => 
        t.type === 'Document Parsing' && 
        t.fileKey === fileKey && 
        t.parsingDetail?.versionId === versionId
    )
    
    if (task) {
      task.status = 'completed'
      task.progress = 100
      if (task.parsingDetail) {
        task.parsingDetail.percentage = 100
        task.parsingDetail.state = 'done'
      }
      console.log('[TaskMonitor] Document parsing task completed', { fileKey, versionId })
    }
  }

  /**
   * 文档解析任务失败
   */
  function failDocumentParsingTask(fileKey: string, versionId: string, errorMessage?: string) {
    const task = tasks.value.find(
      (t) => 
        t.type === 'Document Parsing' && 
        t.fileKey === fileKey && 
        t.parsingDetail?.versionId === versionId
    )
    
    if (task) {
      task.status = 'failed'
      if (errorMessage) {
        task.name = `${task.name} (失败: ${errorMessage})`
      }
      if (task.parsingDetail) {
        task.parsingDetail.state = 'failed'
      }
      console.log('[TaskMonitor] Document parsing task failed', { fileKey, versionId, error: errorMessage })
    }
  }

  // ========== MinerU 进度监听器初始化 ==========

  const minerUListenerInitialized = ref(false)

  /**
   * 初始化 MinerU 进度监听器
   * 订阅主进程推送的文档解析进度事件
   */
  function initMinerUProgressListener() {
    if (minerUListenerInitialized.value) return
    minerUListenerInitialized.value = true

    window.api.minerU.onProgress((evt) => {
      console.log('[TaskMonitor] Received MinerU progress event', evt)
      
      updateDocumentParsingProgress({
        fileKey: evt.fileKey,
        versionId: evt.versionId,
        batchId: evt.batchId,
        state: evt.state,
        progress: evt.progress,
        extractedPages: evt.extractedPages,
        totalPages: evt.totalPages
      })
    })

    console.log('[TaskMonitor] MinerU progress listener initialized')
  }

  // 自动初始化监听器
  initMinerUProgressListener()

  // ========== 分块任务管理 ==========

  /**
   * 添加分块任务
   * 任务名称格式：知识库名-文档名-分块
   */
  function addChunkingTask(
    fileKey: string,
    fileName: string,
    knowledgeBaseId: number,
    knowledgeBaseName: string
  ) {
    // 检查是否已存在相同的任务
    const existingTask = tasks.value.find(
      (t) => t.type === 'Chunking' && t.fileKey === fileKey && t.status === 'running'
    )
    if (existingTask) {
      console.log('[TaskMonitor] Chunking task already exists', { fileKey })
      return existingTask.id
    }

    const taskId = `chunking-${fileKey}-${Date.now()}`
    const task: Task = {
      id: taskId,
      name: `${knowledgeBaseName}-${fileName}-分块`,
      type: 'Chunking',
      status: 'pending',
      progress: 0,
      owner: 'System',
      started: '刚刚',
      knowledgeBaseId,
      knowledgeBaseName,
      fileKey,
      fileName,
      chunkingDetail: {
        percentage: 0,
        totalChunks: 0
      }
    }
    tasks.value.push(task)
    console.log('[TaskMonitor] Added chunking task', { taskId, fileKey, fileName, knowledgeBaseName })
    return taskId
  }

  /**
   * 更新分块进度
   */
  function updateChunkingProgress(progressData: {
    fileKey: string
    percentage: number
    totalChunks: number
    currentDetail?: string
  }) {
    const task = tasks.value.find(
      (t) => t.type === 'Chunking' && t.fileKey === progressData.fileKey && t.status !== 'completed' && t.status !== 'failed'
    )
    
    if (task && task.chunkingDetail) {
      task.status = 'running'
      task.progress = progressData.percentage
      task.chunkingDetail.percentage = progressData.percentage
      task.chunkingDetail.totalChunks = progressData.totalChunks
      task.chunkingDetail.currentDetail = progressData.currentDetail
      
      console.log('[TaskMonitor] Updated chunking progress', { 
        fileKey: progressData.fileKey, 
        progress: progressData.percentage,
        totalChunks: progressData.totalChunks
      })
    } else {
      console.warn('[TaskMonitor] Chunking task not found for progress update', { 
        fileKey: progressData.fileKey
      })
    }
  }

  /**
   * 完成分块任务
   */
  function completeChunkingTask(fileKey: string, totalChunks: number) {
    const task = tasks.value.find(
      (t) => t.type === 'Chunking' && t.fileKey === fileKey && t.status !== 'completed'
    )
    
    if (task) {
      task.status = 'completed'
      task.progress = 100
      if (task.chunkingDetail) {
        task.chunkingDetail.percentage = 100
        task.chunkingDetail.totalChunks = totalChunks
        task.chunkingDetail.currentDetail = `生成了 ${totalChunks} 个分块`
      }
      console.log('[TaskMonitor] Chunking task completed', { fileKey, totalChunks })
    }
  }

  /**
   * 分块任务失败
   */
  function failChunkingTask(fileKey: string, errorMessage?: string) {
    const task = tasks.value.find(
      (t) => t.type === 'Chunking' && t.fileKey === fileKey && t.status !== 'completed' && t.status !== 'failed'
    )
    
    if (task) {
      task.status = 'failed'
      if (errorMessage) {
        task.name = `${task.name} (失败: ${errorMessage})`
      }
      console.log('[TaskMonitor] Chunking task failed', { fileKey, error: errorMessage })
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

  // ========== 嵌入任务管理 ==========

  /**
   * 添加嵌入任务
   * 任务名称格式：知识库名-文档名-嵌入
   */
  function addEmbeddingTask(
    fileKey: string,
    fileName: string,
    knowledgeBaseId: number,
    knowledgeBaseName: string,
    configId: string
  ) {
    // 检查是否已存在相同的任务
    const existingTask = tasks.value.find(
      (t) => t.type === 'Embedding' && t.fileKey === fileKey && t.status === 'running'
    )
    if (existingTask) {
      console.log('[TaskMonitor] Embedding task already exists', { fileKey })
      return existingTask.id
    }

    const taskId = `embedding-${fileKey}-${Date.now()}`
    const task: Task = {
      id: taskId,
      name: `${knowledgeBaseName}-${fileName}-嵌入`,
      type: 'Embedding',
      status: 'pending',
      progress: 0,
      owner: 'System',
      started: '刚刚',
      knowledgeBaseId,
      knowledgeBaseName,
      fileKey,
      fileName,
      embeddingDetail: {
        percentage: 0,
        totalVectors: 0,
        processedVectors: 0,
        configId
      }
    }
    tasks.value.push(task)
    console.log('[TaskMonitor] Added embedding task', { taskId, fileKey, fileName, knowledgeBaseName })
    return taskId
  }

  /**
   * 更新嵌入进度
   */
  function updateEmbeddingProgress(progressData: {
    fileKey: string
    percentage: number
    totalVectors: number
    processedVectors: number
    currentDetail?: string
  }) {
    const task = tasks.value.find(
      (t) => t.type === 'Embedding' && t.fileKey === progressData.fileKey && t.status !== 'completed' && t.status !== 'failed'
    )
    
    if (task && task.embeddingDetail) {
      task.status = 'running'
      task.progress = progressData.percentage
      task.embeddingDetail.percentage = progressData.percentage
      task.embeddingDetail.totalVectors = progressData.totalVectors
      task.embeddingDetail.processedVectors = progressData.processedVectors
      task.embeddingDetail.currentDetail = progressData.currentDetail
      
      console.log('[TaskMonitor] Updated embedding progress', { 
        fileKey: progressData.fileKey, 
        progress: progressData.percentage,
        processedVectors: progressData.processedVectors,
        totalVectors: progressData.totalVectors
      })
    } else {
      console.warn('[TaskMonitor] Embedding task not found for progress update', { 
        fileKey: progressData.fileKey
      })
    }
  }

  /**
   * 完成嵌入任务
   */
  function completeEmbeddingTask(fileKey: string, totalVectors: number) {
    const task = tasks.value.find(
      (t) => t.type === 'Embedding' && t.fileKey === fileKey && t.status !== 'completed'
    )
    
    if (task) {
      task.status = 'completed'
      task.progress = 100
      if (task.embeddingDetail) {
        task.embeddingDetail.percentage = 100
        task.embeddingDetail.totalVectors = totalVectors
        task.embeddingDetail.processedVectors = totalVectors
        task.embeddingDetail.currentDetail = `生成了 ${totalVectors} 个向量`
      }
      console.log('[TaskMonitor] Embedding task completed', { fileKey, totalVectors })
    }
  }

  /**
   * 嵌入任务失败
   */
  function failEmbeddingTask(fileKey: string, errorMessage?: string) {
    const task = tasks.value.find(
      (t) => t.type === 'Embedding' && t.fileKey === fileKey && t.status !== 'completed' && t.status !== 'failed'
    )
    
    if (task) {
      task.status = 'failed'
      if (errorMessage) {
        task.name = `${task.name} (失败: ${errorMessage})`
      }
      console.log('[TaskMonitor] Embedding task failed', { fileKey, error: errorMessage })
    }
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

    // 文档解析任务管理
    addDocumentParsingTask,
    updateDocumentParsingProgress,
    completeDocumentParsingTask,
    failDocumentParsingTask,

    // 分块任务管理
    addChunkingTask,
    updateChunkingProgress,
    completeChunkingTask,
    failChunkingTask,

    // 嵌入任务管理
    addEmbeddingTask,
    updateEmbeddingProgress,
    completeEmbeddingTask,
    failEmbeddingTask,

    // 通用任务管理
    removeTask,
    clearCompletedTasks
  }
})

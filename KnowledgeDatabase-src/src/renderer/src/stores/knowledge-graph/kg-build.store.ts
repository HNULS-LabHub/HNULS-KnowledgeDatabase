/**
 * 知识图谱构建状态 Store
 * 管理知识图谱构建任务的前端状态，通过 preload API 与后端通信
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { KgBuildState, KgBuildStatus } from './kg-build.types'
import type { KGSubmitTaskParams, KnowledgeGraphModelConfig } from '@preload/types'

/** startBuild 所需的参数 */
export interface StartBuildParams {
  fileKey: string
  databaseName: string
  kgConfig: KnowledgeGraphModelConfig
  embeddingTableName: string
}

export const useKgBuildStore = defineStore('kg-build', () => {
  const stateByFileKey = ref<Map<string, KgBuildState>>(new Map())

  // 事件取消订阅函数
  const unsubscribers: (() => void)[] = []

  // ==========================================================================
  // Getters
  // ==========================================================================

  const getState = computed(() => (fileKey: string): KgBuildState | null => {
    return stateByFileKey.value.get(fileKey) ?? null
  })

  const isRunning = computed(() => (fileKey: string): boolean => {
    const s = stateByFileKey.value.get(fileKey)?.status
    return s === 'running' || s === 'pending'
  })

  // ==========================================================================
  // Actions
  // ==========================================================================

  /** 提交知识图谱构建任务 */
  async function startBuild(
    params: StartBuildParams
  ): Promise<{ success: boolean; error?: string }> {
    const { fileKey, databaseName, kgConfig, embeddingTableName } = params

    // 先设为 pending
    stateByFileKey.value.set(fileKey, {
      fileKey,
      kgConfigId: kgConfig.id,
      status: 'pending',
      chunksTotal: 0,
      chunksCompleted: 0,
      chunksFailed: 0
    })

    // 构造提交参数
    // 注意：IPC structured clone 不能克隆 Vue/Pinia 的 Proxy 对象（会报: An object could not be cloned）
    // 这里显式把 entityTypes 转成纯数组再传给后端。
    const safeEntityTypes = Array.from(kgConfig.entityTypes ?? [])

    const submitParams: KGSubmitTaskParams = {
      fileKey,
      sourceNamespace: 'knowledge',
      sourceDatabase: databaseName,
      sourceTable: embeddingTableName,
      config: {
        model: `${kgConfig.llmProviderId}/${kgConfig.llmModelId}`,
        providerId: kgConfig.llmProviderId,
        modelId: kgConfig.llmModelId,
        entityTypes: safeEntityTypes,
        outputLanguage: kgConfig.outputLanguage,
        llmConcurrency: kgConfig.chunkConcurrency,
        embeddingConfigId: kgConfig.embeddingConfigId
      }
    }

    try {
      const result = await window.api.knowledgeGraph.submitTask(submitParams)

      stateByFileKey.value.set(fileKey, {
        fileKey,
        taskId: result.taskId,
        kgConfigId: kgConfig.id,
        status: 'running',
        chunksTotal: result.chunksTotal,
        chunksCompleted: 0,
        chunksFailed: 0
      })

      return { success: true }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      stateByFileKey.value.set(fileKey, {
        fileKey,
        kgConfigId: kgConfig.id,
        status: 'failed',
        chunksTotal: 0,
        chunksCompleted: 0,
        chunksFailed: 0,
        error: errMsg
      })
      return { success: false, error: errMsg }
    }
  }

  /** 查询后端所有任务状态并同步到本地 */
  async function refreshStatus(): Promise<void> {
    try {
      const tasks = await window.api.knowledgeGraph.queryStatus()
      for (const t of tasks) {
        const existing = findByTaskId(t.taskId)
        if (existing) {
          existing.status = mapStatus(t.status)
          existing.chunksTotal = t.chunksTotal
          existing.chunksCompleted = t.chunksCompleted
          existing.chunksFailed = t.chunksFailed
        }
      }
    } catch {
      // 静默失败
    }
  }

  function setState(fileKey: string, status: KgBuildStatus, error?: string): void {
    const existing = stateByFileKey.value.get(fileKey)
    if (existing) {
      stateByFileKey.value.set(fileKey, { ...existing, status, error })
    }
  }

  // ==========================================================================
  // 事件监听（从后端推送）
  // ==========================================================================

  function setupListeners(): void {
    unsubscribers.push(
      window.api.knowledgeGraph.onTaskProgress((taskId, completed, failed, total) => {
        const state = findByTaskId(taskId)
        if (state) {
          state.chunksCompleted = completed
          state.chunksFailed = failed
          state.chunksTotal = total
        }
      })
    )

    unsubscribers.push(
      window.api.knowledgeGraph.onTaskCompleted((taskId) => {
        const state = findByTaskId(taskId)
        if (state) state.status = 'completed'
      })
    )

    unsubscribers.push(
      window.api.knowledgeGraph.onTaskFailed((taskId, error) => {
        const state = findByTaskId(taskId)
        if (state) {
          state.status = 'failed'
          state.error = error
        }
      })
    )
  }

  function teardownListeners(): void {
    unsubscribers.forEach((fn) => fn())
    unsubscribers.length = 0
  }

  // ==========================================================================
  // 内部工具
  // ==========================================================================

  function findByTaskId(taskId: string): KgBuildState | undefined {
    for (const state of stateByFileKey.value.values()) {
      if (state.taskId === taskId) return state
    }
    return undefined
  }

  function mapStatus(backendStatus: string): KgBuildStatus {
    switch (backendStatus) {
      case 'pending':
        return 'pending'
      case 'paused': return 'pending'
      case 'progressing':
        return 'running'
      case 'completed':
        return 'completed'
      case 'failed':
        return 'failed'
      default:
        return 'idle'
    }
  }

  // 初始化监听
  setupListeners()

  return {
    stateByFileKey,
    getState,
    isRunning,
    startBuild,
    refreshStatus,
    setState,
    setupListeners,
    teardownListeners
  }
})

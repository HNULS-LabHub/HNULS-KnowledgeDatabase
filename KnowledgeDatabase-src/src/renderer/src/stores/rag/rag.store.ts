/**
 * RAG 检索状态管理 Store
 * 配置持久化到 localStorage
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { RagDataSource } from './rag.datasource'
import type { RagStep, RagConfig, RerankModel, LlmModel } from './rag.types'

const STORAGE_KEY = 'rag-config'

/** 从 localStorage 读取配置 */
function loadConfig(): RagConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as RagConfig
  } catch {
    console.warn('[RagStore] Failed to parse localStorage config')
  }
  return {
    rerankModelId: null,
    llmModelId: null,
    llmDrivenEnabled: false,
    selectedKnowledgeBaseId: null
  }
}

/** 写入 localStorage */
function saveConfig(config: RagConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    console.warn('[RagStore] Failed to save config to localStorage')
  }
}

export const useRagStore = defineStore('rag', () => {
  // ---- 从 localStorage 恢复持久化配置 ----
  const persisted = loadConfig()

  // ---- State: 配置（持久化） ----
  const rerankModelId = ref<string | null>(persisted.rerankModelId)
  const llmModelId = ref<string | null>(persisted.llmModelId)
  const llmDrivenEnabled = ref(persisted.llmDrivenEnabled)
  const selectedKnowledgeBaseId = ref<number | null>(persisted.selectedKnowledgeBaseId)

  // ---- State: 运行时（不持久化） ----
  const query = ref('')
  const isSearching = ref(false)
  const steps = ref<RagStep[]>([])

  // ---- State: 模型列表（从 datasource 加载） ----
  const rerankModels = ref<RerankModel[]>([])
  const llmModels = ref<LlmModel[]>([])
  const modelsLoading = ref(false)

  // ---- Getters ----
  const hasCompleted = computed(() => steps.value.length >= 4 && !isSearching.value)

  const currentConfig = computed<RagConfig>(() => ({
    rerankModelId: rerankModelId.value,
    llmModelId: llmModelId.value,
    llmDrivenEnabled: llmDrivenEnabled.value,
    selectedKnowledgeBaseId: selectedKnowledgeBaseId.value
  }))

  // ---- 内部: 持久化 ----
  function persistConfig(): void {
    saveConfig(currentConfig.value)
  }

  // ---- Actions: 配置变更 ----
  function setRerankModel(id: string | null): void {
    rerankModelId.value = id
    persistConfig()
  }

  function setLlmModel(id: string | null): void {
    llmModelId.value = id
    persistConfig()
  }

  function toggleLlmDriven(value?: boolean): void {
    llmDrivenEnabled.value = value ?? !llmDrivenEnabled.value
    // 关闭时不清除已选的 LLM，只是 UI 上 disabled
    persistConfig()
  }

  function setKnowledgeBase(id: number | null): void {
    selectedKnowledgeBaseId.value = id
    persistConfig()
  }

  // ---- Actions: 加载模型列表 ----
  async function loadModels(): Promise<void> {
    if (modelsLoading.value) return
    modelsLoading.value = true
    try {
      const [rerank, llm] = await Promise.all([
        RagDataSource.getRerankModels(),
        RagDataSource.getLlmModels()
      ])
      rerankModels.value = rerank
      llmModels.value = llm
    } finally {
      modelsLoading.value = false
    }
  }

  // ---- Actions: 执行检索 ----
  async function executeSearch(): Promise<void> {
    if (!query.value.trim() || isSearching.value) return
    isSearching.value = true
    steps.value = []

    try {
      await RagDataSource.executeSearch(query.value, (newSteps) => {
        steps.value = newSteps
      })
    } finally {
      isSearching.value = false
    }
  }

  return {
    // State
    rerankModelId,
    llmModelId,
    llmDrivenEnabled,
    selectedKnowledgeBaseId,
    query,
    isSearching,
    steps,
    rerankModels,
    llmModels,
    modelsLoading,
    // Getters
    hasCompleted,
    currentConfig,
    // Actions
    setRerankModel,
    setLlmModel,
    toggleLlmDriven,
    setKnowledgeBase,
    loadModels,
    executeSearch
  }
})

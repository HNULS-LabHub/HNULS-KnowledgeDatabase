/**
 * RAG 检索状态管理 Store
 * 配置持久化到 localStorage
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { RagDataSource } from './rag.datasource'
import type { RagStep, RagConfig, VectorRecallHit, EmbeddingTableConfig } from './rag.types'

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
    rerankEnabled: false,
    rerankModelId: null,
    llmModelId: null,
    llmDrivenEnabled: false,
    selectedKnowledgeBaseId: null,
    embeddingTableConfigs: {}
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
  const rerankEnabled = ref(persisted.rerankEnabled ?? false)
  const rerankModelId = ref<string | null>(persisted.rerankModelId)
  const llmModelId = ref<string | null>(persisted.llmModelId)
  const llmDrivenEnabled = ref(persisted.llmDrivenEnabled)
  const selectedKnowledgeBaseId = ref<number | null>(persisted.selectedKnowledgeBaseId)
  const embeddingTableConfigs = ref<Record<string, EmbeddingTableConfig>>(
    persisted.embeddingTableConfigs || {}
  )

  // ---- State: 运行时（不持久化） ----
  const query = ref('')
  const isSearching = ref(false)
  const steps = ref<RagStep[]>([])
  const recallResults = ref<VectorRecallHit[]>([])
  const searchElapsedMs = ref<number | null>(null)
  // 向量表元数据 (tableName -> { configName, dimensions })
  const embeddingTablesMetadata = ref<Map<string, { configName?: string; dimensions?: number }>>(
    new Map()
  )

  // ---- Getters ----
  const hasCompleted = computed(() => steps.value.length >= 4 && !isSearching.value)

  /** 已启用的向量表列表 */
  const enabledEmbeddingTables = computed(() => {
    return Object.entries(embeddingTableConfigs.value)
      .filter(([_, config]) => config.enabled)
      .map(([tableName]) => tableName)
  })

  const currentConfig = computed<RagConfig>(() => ({
    rerankEnabled: rerankEnabled.value,
    rerankModelId: rerankModelId.value,
    llmModelId: llmModelId.value,
    llmDrivenEnabled: llmDrivenEnabled.value,
    selectedKnowledgeBaseId: selectedKnowledgeBaseId.value,
    embeddingTableConfigs: embeddingTableConfigs.value
  }))

  // ---- 内部: 持久化 ----
  function persistConfig(): void {
    saveConfig(currentConfig.value)
  }

  // ---- Actions: 配置变更 ----
  function toggleRerank(value?: boolean): void {
    rerankEnabled.value = value ?? !rerankEnabled.value
    persistConfig()
  }

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
    // 切换知识库时清空已选向量表
    embeddingTableConfigs.value = {}
    embeddingTablesMetadata.value.clear()
    persistConfig()
  }

  /** 切换向量表的启用状态 */
  function toggleEmbeddingTable(tableName: string, defaultK = 10): void {
    const current = embeddingTableConfigs.value[tableName]
    if (current?.enabled) {
      // 已启用 -> 禁用
      embeddingTableConfigs.value[tableName] = { ...current, enabled: false }
    } else {
      // 未启用 -> 启用（使用默认或已有 k 值）
      embeddingTableConfigs.value[tableName] = {
        enabled: true,
        k: current?.k ?? defaultK
      }
    }
    persistConfig()
  }

  /** 设置向量表的 k 值 */
  function setEmbeddingTableK(tableName: string, k: number): void {
    const current = embeddingTableConfigs.value[tableName]
    if (current) {
      embeddingTableConfigs.value[tableName] = { ...current, k }
      persistConfig()
    }
  }

  /** 批量设置向量表启用状态 */
  function setAllEmbeddingTables(tableNames: string[], enabled: boolean, defaultK = 10): void {
    for (const tableName of tableNames) {
      const current = embeddingTableConfigs.value[tableName]
      embeddingTableConfigs.value[tableName] = {
        enabled,
        k: current?.k ?? defaultK
      }
    }
    persistConfig()
  }

  /** 更新向量表元数据 */
  function setEmbeddingTablesMetadata(
    tables: Array<{ tableName: string; configName?: string; dimensions?: number }>
  ): void {
    embeddingTablesMetadata.value.clear()
    for (const t of tables) {
      embeddingTablesMetadata.value.set(t.tableName, {
        configName: t.configName,
        dimensions: t.dimensions
      })
    }
  }

  // ---- Actions: 执行检索 ----
  async function executeSearch(): Promise<void> {
    if (!query.value.trim() || isSearching.value) return
    isSearching.value = true
    steps.value = []
    recallResults.value = []
    searchElapsedMs.value = null

    const startTime = performance.now()

    try {
      const { hits } = await RagDataSource.executeSearch(
        query.value,
        {
          knowledgeBaseId: selectedKnowledgeBaseId.value!,
          embeddingTableConfigs: embeddingTableConfigs.value
        },
        embeddingTablesMetadata.value,
        (newSteps) => {
          steps.value = newSteps
        }
      )
      recallResults.value = hits
    } finally {
      searchElapsedMs.value = Math.round(performance.now() - startTime)
      isSearching.value = false
    }
  }

  return {
    // State
    rerankEnabled,
    rerankModelId,
    llmModelId,
    llmDrivenEnabled,
    selectedKnowledgeBaseId,
    embeddingTableConfigs,
    query,
    isSearching,
    steps,
    recallResults,
    searchElapsedMs,
    // Getters
    hasCompleted,
    enabledEmbeddingTables,
    currentConfig,
    // Actions
    toggleRerank,
    setRerankModel,
    setLlmModel,
    toggleLlmDriven,
    setKnowledgeBase,
    toggleEmbeddingTable,
    setEmbeddingTableK,
    setAllEmbeddingTables,
    setEmbeddingTablesMetadata,
    executeSearch
  }
})

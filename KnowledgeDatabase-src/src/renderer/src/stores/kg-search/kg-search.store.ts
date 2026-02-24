/**
 * 知识图谱检索状态管理 Store
 * 负责从各 store 组装 KGRetrievalParams 并调用 IPC
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { KGSearchDataSource } from './kg-search.datasource'
import { useKnowledgeLibraryStore } from '../knowledge-library/knowledge-library.store'
import { useKnowledgeConfigStore } from '../knowledge-library/knowledge-config.store'
import { useUserModelConfigStore } from '../user-config/user-model-config.store'
import type {
  KGRetrievalMode,
  KGRetrievalParams,
  KGRetrievalResult
} from '@preload/types'
import type {
  KGResultTab,
  KGVectorSearchUI,
  KGGraphTraversalUI
} from './kg-search.types'

export const useKGSearchStore = defineStore('kg-search', () => {
  // ---- 依赖 stores ----
  const kbStore = useKnowledgeLibraryStore()
  const configStore = useKnowledgeConfigStore()
  const modelStore = useUserModelConfigStore()

  // ---- State: 查询 ----
  const query = ref('')
  const mode = ref<KGRetrievalMode>('local')
  const isSearching = ref(false)
  const result = ref<KGRetrievalResult | null>(null)
  const error = ref<string | null>(null)

  // ---- State: 上下文选择 ----
  const selectedKbId = ref<number | null>(null)
  const selectedKgConfigId = ref<string | null>(null)

  // ---- State: 结果展示 ----
  const activeResultTab = ref<KGResultTab>('entities')

  // ---- State: 高级参数 ----
  const advancedExpanded = ref(false)
  const vectorSearch = ref<KGVectorSearchUI>({
    entityTopK: 20,
    relationTopK: 20,
    chunkTopK: 60
  })
  const graphTraversal = ref<KGGraphTraversalUI>({
    maxDepth: 1,
    maxNeighbors: 10
  })
  const rerankEnabled = ref(false)
  const rerankProviderId = ref<string | null>(null)
  const rerankModelId = ref('')
  const keywordUseLLM = ref(false)
  const manualHighKeywords = ref('')
  const manualLowKeywords = ref('')

  // ---- Getters ----
  const hasResult = computed(() => result.value !== null)
  const entityCount = computed(() => result.value?.entities.length ?? 0)
  const relationCount = computed(() => result.value?.relations.length ?? 0)
  const chunkCount = computed(() => result.value?.chunks.length ?? 0)
  const totalCount = computed(() => entityCount.value + relationCount.value + chunkCount.value)

  /** 当前选中的知识库 */
  const selectedKb = computed(() => {
    if (!selectedKbId.value) return null
    return kbStore.getById(selectedKbId.value) ?? null
  })

  /** 当前知识库可用的 KG 配置列表（仅已建表的） */
  const availableKgConfigs = computed(() => {
    if (!selectedKbId.value) return []
    return configStore.getKgConfigs(selectedKbId.value).filter((c) => c.graphTablesCreated && c.graphTableBase)
  })

  /** 当前选中的 KG 配置 */
  const selectedKgConfig = computed(() => {
    if (!selectedKbId.value || !selectedKgConfigId.value) return null
    return availableKgConfigs.value.find((c) => c.id === selectedKgConfigId.value) ?? null
  })

  /** 校验：是否可以执行检索 */
  const canSearch = computed(() => {
    if (!query.value.trim()) return false
    if (!selectedKbId.value || !selectedKb.value) return false
    if (!selectedKgConfigId.value || !selectedKgConfig.value) return false
    if (isSearching.value) return false
    return true
  })

  /** 校验缺失项提示 */
  const validationHint = computed(() => {
    if (!selectedKbId.value) return '请选择知识库'
    if (!selectedKgConfigId.value) return '请选择图谱配置'
    if (availableKgConfigs.value.length === 0) return '当前知识库无可用图谱配置'
    if (!query.value.trim()) return '请输入检索词'
    return null
  })

  // ---- Actions ----
  function setMode(newMode: KGRetrievalMode): void {
    mode.value = newMode
  }

  function setKb(kbId: number | null): void {
    selectedKbId.value = kbId
    selectedKgConfigId.value = null
    result.value = null
    error.value = null
  }

  function setKgConfig(configId: string | null): void {
    selectedKgConfigId.value = configId
    result.value = null
    error.value = null
  }

  function setResultTab(tab: KGResultTab): void {
    activeResultTab.value = tab
  }

  /**
   * 从各 store 组装 KGRetrievalParams
   */
  function buildParams(): KGRetrievalParams | null {
    const kb = selectedKb.value
    const kgCfg = selectedKgConfig.value
    if (!kb || !kgCfg || !selectedKbId.value) return null

    // 获取嵌入配置
    const embConfigs = configStore.getEmbeddingConfigs(selectedKbId.value)
    const embCfg = embConfigs.find((c) => c.id === kgCfg.embeddingConfigId)
    if (!embCfg || !embCfg.candidates.length) {
      error.value = '嵌入配置缺失或无候选模型'
      return null
    }

    const candidate = embCfg.candidates[0]
    const provider = modelStore.providers.find((p) => p.id === candidate.providerId)
    if (!provider) {
      error.value = `找不到嵌入模型提供商: ${candidate.providerId}`
      return null
    }
    if (!provider.baseUrl || !provider.apiKey) {
      error.value = `提供商 "${provider.name}" 缺少 baseUrl 或 apiKey`
      return null
    }

    // 推导 chunkTableName
    const safeId = kgCfg.embeddingConfigId.replace(/[^a-zA-Z0-9_]/g, '_')
    const dimensions = embCfg.dimensions ?? 0
    const chunkTableName = `emb_cfg_${safeId}_${dimensions}_chunks`

    const params: KGRetrievalParams = {
      query: query.value.trim(),
      mode: mode.value,
      targetNamespace: 'knowledge',
      targetDatabase: kb.databaseName,
      graphTableBase: kgCfg.graphTableBase!,
      embeddingConfig: {
        providerId: candidate.providerId,
        modelId: candidate.modelId,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        dimensions
      },
      chunkTableName,
      vectorSearch: {
        entityTopK: vectorSearch.value.entityTopK,
        relationTopK: vectorSearch.value.relationTopK,
        chunkTopK: vectorSearch.value.chunkTopK
      },
      graphTraversal: {
        maxDepth: graphTraversal.value.maxDepth,
        maxNeighbors: graphTraversal.value.maxNeighbors
      },
      rerank: { enabled: rerankEnabled.value }
    }

    // rerank 配置
    if (rerankEnabled.value && rerankProviderId.value && rerankModelId.value) {
      const rerankProvider = modelStore.providers.find((p) => p.id === rerankProviderId.value)
      if (rerankProvider?.baseUrl && rerankProvider?.apiKey) {
        params.rerank = {
          enabled: true,
          providerId: rerankProviderId.value,
          modelId: rerankModelId.value,
          baseUrl: rerankProvider.baseUrl,
          apiKey: rerankProvider.apiKey
        }
      }
    }

    // 关键词提取
    if (keywordUseLLM.value && kgCfg.llmProviderId && kgCfg.llmModelId) {
      params.keywordExtraction = {
        useLLM: true,
        llmProviderId: kgCfg.llmProviderId,
        llmModelId: kgCfg.llmModelId
      }
    } else {
      const highKw = manualHighKeywords.value.split(/[,，\s]+/).filter(Boolean)
      const lowKw = manualLowKeywords.value.split(/[,，\s]+/).filter(Boolean)
      params.keywordExtraction = {
        useLLM: false,
        manualHighLevelKeywords: highKw.length > 0 ? highKw : undefined,
        manualLowLevelKeywords: lowKw.length > 0 ? lowKw : undefined
      }
    }

    return params
  }

  async function executeSearch(): Promise<void> {
    if (!canSearch.value) return

    error.value = null
    isSearching.value = true
    result.value = null

    try {
      const params = buildParams()
      if (!params) {
        isSearching.value = false
        return
      }

      result.value = await KGSearchDataSource.search(params)

      // 自动切换到有数据的 tab
      if (result.value.entities.length > 0) {
        activeResultTab.value = 'entities'
      } else if (result.value.relations.length > 0) {
        activeResultTab.value = 'relations'
      } else if (result.value.chunks.length > 0) {
        activeResultTab.value = 'chunks'
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      error.value = `检索失败: ${msg}`
      console.error('[KGSearchStore] Search failed:', err)
    } finally {
      isSearching.value = false
    }
  }

  function reset(): void {
    query.value = ''
    result.value = null
    error.value = null
    isSearching.value = false
  }

  return {
    // State
    query,
    mode,
    isSearching,
    result,
    error,
    selectedKbId,
    selectedKgConfigId,
    activeResultTab,
    advancedExpanded,
    vectorSearch,
    graphTraversal,
    rerankEnabled,
    rerankProviderId,
    rerankModelId,
    keywordUseLLM,
    manualHighKeywords,
    manualLowKeywords,
    // Getters
    hasResult,
    entityCount,
    relationCount,
    chunkCount,
    totalCount,
    selectedKb,
    availableKgConfigs,
    selectedKgConfig,
    canSearch,
    validationHint,
    // Actions
    setMode,
    setKb,
    setKgConfig,
    setResultTab,
    executeSearch,
    reset
  }
})

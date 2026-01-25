import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { KnowledgeConfigDataSource } from './knowledge-config.datasource'
import type {
  KnowledgeConfig,
  KnowledgeGlobalConfig,
  DocumentConfig,
  EmbeddingConfig,
  EmbeddingModelConfig,
  EmbeddingModelCandidate
} from '@preload/types'

export const useKnowledgeConfigStore = defineStore('knowledge-config', () => {
  // 按知识库ID缓存配置
  const configByKbId = ref<Map<number, KnowledgeConfig>>(new Map())
  const loading = ref(false)

  /**
   * 获取知识库配置
   */
  const getConfig = computed(() => (kbId: number): KnowledgeConfig | null => {
    return configByKbId.value.get(kbId) ?? null
  })

  /**
   * 获取全局配置
   */
  const getGlobalConfig = computed(() => (kbId: number): KnowledgeGlobalConfig | null => {
    return configByKbId.value.get(kbId)?.global ?? null
  })

  /**
   * 获取文档配置（已合并全局）
   */
  const getDocumentConfig = computed(
    () =>
      (kbId: number, fileKey: string): Required<DocumentConfig> | null => {
        const config = configByKbId.value.get(kbId)
        if (!config) return null

        const docConfig = config.documents[fileKey] || {}
        return {
          chunking: {
            mode: 'recursive',
            maxChars: docConfig.chunking?.maxChars ?? config.global.chunking.maxChars
          }
        }
      }
  )

  /**
   * 检查文档是否有独立配置
   */
  const hasCustomConfig = computed(() => (kbId: number, fileKey: string): boolean => {
    const config = configByKbId.value.get(kbId)
    return !!config?.documents[fileKey]
  })

  /**
   * 加载配置
   */
  async function loadConfig(kbId: number): Promise<KnowledgeConfig> {
    loading.value = true
    try {
      const config = await KnowledgeConfigDataSource.getConfig(kbId)
      configByKbId.value.set(kbId, config)
      return config
    } finally {
      loading.value = false
    }
  }

  /**
   * 更新全局配置
   */
  async function updateGlobalConfig(
    kbId: number,
    globalConfig: Partial<KnowledgeGlobalConfig>
  ): Promise<void> {
    const config = await KnowledgeConfigDataSource.updateGlobalConfig(kbId, globalConfig)
    configByKbId.value.set(kbId, config)
  }

  /**
   * 更新文档配置
   */
  async function updateDocumentConfig(
    kbId: number,
    fileKey: string,
    docConfig: DocumentConfig
  ): Promise<void> {
    const config = await KnowledgeConfigDataSource.updateDocumentConfig(kbId, fileKey, docConfig)
    configByKbId.value.set(kbId, config)
  }

  /**
   * 清除文档配置（回正）
   */
  async function clearDocumentConfig(kbId: number, fileKey: string): Promise<void> {
    const config = await KnowledgeConfigDataSource.clearDocumentConfig(kbId, fileKey)
    configByKbId.value.set(kbId, config)
  }

  /**
   * 获取嵌入配置列表
   */
  const getEmbeddingConfigs = computed(() => (kbId: number): EmbeddingModelConfig[] => {
    return configByKbId.value.get(kbId)?.global.embedding?.configs ?? []
  })

  /**
   * 创建嵌入配置项
   */
  async function createEmbeddingConfig(
    kbId: number,
    configData: { name: string; presetName?: string; dimensions?: number }
  ): Promise<EmbeddingModelConfig> {
    const newConfig: EmbeddingModelConfig = {
      id: `cfg_${Date.now()}`,
      name: configData.name,
      presetName: configData.presetName,
      dimensions: configData.dimensions,
      candidates: []
    }

    const currentConfigs = getEmbeddingConfigs.value(kbId)
    const updatedEmbedding: EmbeddingConfig = {
      configs: JSON.parse(JSON.stringify([...currentConfigs, newConfig]))
    }

    await updateGlobalConfig(kbId, { embedding: updatedEmbedding })
    return newConfig
  }

  /**
   * 更新嵌入配置项的候选节点
   */
  async function updateEmbeddingCandidates(
    kbId: number,
    configId: string,
    candidates: EmbeddingModelCandidate[]
  ): Promise<void> {
    const currentConfigs = getEmbeddingConfigs.value(kbId)

    const updatedConfigs = currentConfigs.map((c) =>
      c.id === configId ? { ...c, candidates: JSON.parse(JSON.stringify(candidates)) } : c
    )

    await updateGlobalConfig(kbId, {
      embedding: { configs: JSON.parse(JSON.stringify(updatedConfigs)) }
    })
  }

  /**
   * 删除嵌入配置项
   */
  async function deleteEmbeddingConfig(kbId: number, configId: string): Promise<void> {
    const currentConfigs = getEmbeddingConfigs.value(kbId)

    const updatedConfigs = currentConfigs.filter((c) => c.id !== configId)

    await updateGlobalConfig(kbId, {
      embedding: { configs: JSON.parse(JSON.stringify(updatedConfigs)) }
    })
  }

  return {
    configByKbId,
    loading,
    getConfig,
    getGlobalConfig,
    getDocumentConfig,
    hasCustomConfig,
    loadConfig,
    updateGlobalConfig,
    updateDocumentConfig,
    clearDocumentConfig,
    getEmbeddingConfigs,
    createEmbeddingConfig,
    updateEmbeddingCandidates,
    deleteEmbeddingConfig
  }
})

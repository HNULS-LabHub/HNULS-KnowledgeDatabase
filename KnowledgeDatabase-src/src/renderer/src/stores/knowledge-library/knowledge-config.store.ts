import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { KnowledgeConfigDataSource } from './knowledge-config.datasource'
import type {
  KnowledgeConfig,
  KnowledgeGlobalConfig,
  DocumentConfig,
  KnowledgeEmbeddingConfig,
  EmbeddingModelConfig,
  EmbeddingModelCandidate,
  KnowledgeGraphSectionConfig,
  KnowledgeGraphModelConfig
} from '@preload/types'

export const useKnowledgeConfigStore = defineStore('knowledge-config', () => {
  // 按知识库ID缓存配置
  const configByKbId = ref<Map<number, KnowledgeConfig>>(new Map())
  const loading = ref(false)
  const loadPromisesByKbId = ref<Map<number, Promise<KnowledgeConfig>>>(new Map())

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
      (
        kbId: number,
        fileKey: string
      ): {
        chunking: Required<import('@shared/chunking.types').ChunkingConfig>
        embeddingConfigId?: string
      } | null => {
        const config = configByKbId.value.get(kbId)
        if (!config) return null

        const docConfig = config.documents[fileKey] || {}
        const globalChunking = config.global.chunking
        const docChunkingAny = docConfig.chunking as any

        const effectiveMode = docChunkingAny?.mode ?? globalChunking.mode

        if (effectiveMode === 'semantic') {
          const baseOverlapChars =
            globalChunking.mode === 'semantic' ? globalChunking.overlapChars : 0
          const docOverlapChars =
            typeof docChunkingAny?.overlapChars === 'number'
              ? docChunkingAny.overlapChars
              : baseOverlapChars

          return {
            chunking: {
              mode: 'semantic',
              maxChars: docConfig.chunking?.maxChars ?? globalChunking.maxChars,
              overlapChars: docOverlapChars
            },
            embeddingConfigId: docConfig.embeddingConfigId
          }
        }

        return {
          chunking: {
            mode: 'recursive',
            maxChars: docConfig.chunking?.maxChars ?? globalChunking.maxChars
          },
          embeddingConfigId: docConfig.embeddingConfigId
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

  async function ensureConfigLoaded(kbId: number): Promise<KnowledgeConfig> {
    const existing = configByKbId.value.get(kbId)
    if (existing) return existing

    const pending = loadPromisesByKbId.value.get(kbId)
    if (pending) return pending

    const promise = loadConfig(kbId).finally(() => {
      loadPromisesByKbId.value.delete(kbId)
    })
    loadPromisesByKbId.value.set(kbId, promise)
    return promise
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
   * 获取默认嵌入配置ID
   */
  const getDefaultEmbeddingConfigId = computed(() => (kbId: number): string | null => {
    return configByKbId.value.get(kbId)?.global.embedding?.defaultConfigId ?? null
  })

  /**
   * 获取文档的嵌入配置ID（文档独立配置 > 全局默认配置）
   */
  const getDocumentEmbeddingConfigId = computed(
    () =>
      (kbId: number, fileKey: string): string | null => {
        const config = configByKbId.value.get(kbId)
        if (!config) return null

        // 优先使用文档独立配置
        const docConfig = config.documents[fileKey]
        if (docConfig?.embeddingConfigId) {
          return docConfig.embeddingConfigId
        }

        // 其次使用全局默认配置
        return config.global.embedding?.defaultConfigId ?? null
      }
  )

  /**
   * 检查文档是否有独立的嵌入配置
   */
  const hasCustomEmbeddingConfig = computed(() => (kbId: number, fileKey: string): boolean => {
    const config = configByKbId.value.get(kbId)
    return !!config?.documents[fileKey]?.embeddingConfigId
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
    const updatedEmbedding: KnowledgeEmbeddingConfig = {
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
    const currentDefaultId = getDefaultEmbeddingConfigId.value(kbId)

    const updatedConfigs = currentConfigs.filter((c) => c.id !== configId)

    // 如果删除的是默认配置，清除 defaultConfigId
    const newDefaultId = configId === currentDefaultId ? undefined : currentDefaultId

    await updateGlobalConfig(kbId, {
      embedding: {
        configs: JSON.parse(JSON.stringify(updatedConfigs)),
        defaultConfigId: newDefaultId
      }
    })
  }

  /**
   * 设置默认嵌入配置ID
   */
  async function setDefaultEmbeddingConfigId(kbId: number, configId: string | null): Promise<void> {
    const currentConfigs = getEmbeddingConfigs.value(kbId)

    await updateGlobalConfig(kbId, {
      embedding: {
        configs: JSON.parse(JSON.stringify(currentConfigs)),
        defaultConfigId: configId ?? undefined
      }
    })
  }

  /**
   * 设置文档的嵌入配置ID
   */
  async function setDocumentEmbeddingConfigId(
    kbId: number,
    fileKey: string,
    configId: string | null
  ): Promise<void> {
    const currentDocConfig = configByKbId.value.get(kbId)?.documents[fileKey] || {}

    if (configId === null) {
      // 清除文档独立的嵌入配置（跟随全局）
      const { embeddingConfigId: _, ...restConfig } = currentDocConfig
      if (Object.keys(restConfig).length === 0) {
        // 如果没有其他配置，完全清除文档配置
        await clearDocumentConfig(kbId, fileKey)
      } else {
        await updateDocumentConfig(kbId, fileKey, restConfig)
      }
    } else {
      // 设置文档独立的嵌入配置
      await updateDocumentConfig(kbId, fileKey, {
        ...currentDocConfig,
        embeddingConfigId: configId
      })
    }
  }

  // ============ 知识图谱配置 ============

  const getKgConfigs = computed(() => (kbId: number): KnowledgeGraphModelConfig[] => {
    return configByKbId.value.get(kbId)?.global.knowledgeGraph?.configs ?? []
  })

  const getDefaultKgConfigId = computed(() => (kbId: number): string | null => {
    return configByKbId.value.get(kbId)?.global.knowledgeGraph?.defaultConfigId ?? null
  })

  async function createKgConfig(
    kbId: number,
    configData: Omit<KnowledgeGraphModelConfig, 'id'>,
    databaseName: string
  ): Promise<KnowledgeGraphModelConfig> {
    // 获取嵌入配置的 dimensions
    const embConfig = getEmbeddingConfigs
      .value(kbId)
      .find((c) => c.id === configData.embeddingConfigId)
    const dimensions = embConfig?.dimensions ?? 0

    // 生成图谱表基名
    const safeId = configData.embeddingConfigId.replace(/[^a-zA-Z0-9_]/g, '_')
    const graphTableBase = `kg_emb_cfg_${safeId}_${dimensions}`

    const newConfig: KnowledgeGraphModelConfig = {
      id: `kg_cfg_${Date.now()}`,
      ...configData,
      graphTableBase,
      graphTablesCreated: false,
      embeddingBatchSize: configData.embeddingBatchSize ?? 20,
      embeddingMaxTokens: configData.embeddingMaxTokens ?? 1500
    }

    const currentConfigs = getKgConfigs.value(kbId)
    const currentDefaultId = getDefaultKgConfigId.value(kbId)
    const updatedKg: KnowledgeGraphSectionConfig = {
      configs: JSON.parse(JSON.stringify([...currentConfigs, newConfig])),
      defaultConfigId: currentDefaultId ?? undefined
    }

    await updateGlobalConfig(kbId, { knowledgeGraph: updatedKg })

    // 创建图谱表 Schema
    try {
      await window.api.knowledgeGraph.createGraphSchema({
        targetNamespace: 'knowledge',
        targetDatabase: databaseName,
        graphTableBase
      })
      newConfig.graphTablesCreated = true
      await updateKgConfig(kbId, newConfig.id, { graphTablesCreated: true })
    } catch (error) {
      console.error('Failed to create graph schema, will retry on load', error)
    }

    return newConfig
  }

  /**
   * 加载配置时，检查所有 KG 配置的 graphTablesCreated 标志
   * 对未创建表的配置尝试建表（IF NOT EXISTS 语义）
   */
  async function ensureGraphTables(kbId: number, databaseName: string): Promise<void> {
    const configs = getKgConfigs.value(kbId)
    for (const cfg of configs) {
      if (cfg.graphTableBase && !cfg.graphTablesCreated) {
        try {
          await window.api.knowledgeGraph.createGraphSchema({
            targetNamespace: 'knowledge',
            targetDatabase: databaseName,
            graphTableBase: cfg.graphTableBase
          })
          await updateKgConfig(kbId, cfg.id, { graphTablesCreated: true })
        } catch (error) {
          console.error(`Failed to ensure graph tables for config ${cfg.id}:`, error)
        }
      }
    }
  }

  async function deleteKgConfig(kbId: number, configId: string): Promise<void> {
    const currentConfigs = getKgConfigs.value(kbId)
    const currentDefaultId = getDefaultKgConfigId.value(kbId)

    const updatedConfigs = currentConfigs.filter((c) => c.id !== configId)
    const newDefaultId = configId === currentDefaultId ? undefined : currentDefaultId

    await updateGlobalConfig(kbId, {
      knowledgeGraph: {
        configs: JSON.parse(JSON.stringify(updatedConfigs)),
        defaultConfigId: newDefaultId
      }
    })
  }

  async function updateKgConfig(
    kbId: number,
    configId: string,
    patch: Partial<Omit<KnowledgeGraphModelConfig, 'id'>>
  ): Promise<void> {
    const currentConfigs = getKgConfigs.value(kbId)
    const updatedConfigs = currentConfigs.map((c) => (c.id === configId ? { ...c, ...patch } : c))

    const currentDefaultId = getDefaultKgConfigId.value(kbId)
    await updateGlobalConfig(kbId, {
      knowledgeGraph: {
        configs: JSON.parse(JSON.stringify(updatedConfigs)),
        defaultConfigId: currentDefaultId ?? undefined
      }
    })
  }

  async function setDefaultKgConfigId(kbId: number, configId: string | null): Promise<void> {
    const currentConfigs = getKgConfigs.value(kbId)
    await updateGlobalConfig(kbId, {
      knowledgeGraph: {
        configs: JSON.parse(JSON.stringify(currentConfigs)),
        defaultConfigId: configId ?? undefined
      }
    })
  }

  return {
    configByKbId,
    loading,
    loadPromisesByKbId,
    getConfig,
    getGlobalConfig,
    getDocumentConfig,
    hasCustomConfig,
    loadConfig,
    ensureConfigLoaded,
    updateGlobalConfig,
    updateDocumentConfig,
    clearDocumentConfig,
    // 嵌入配置相关
    getEmbeddingConfigs,
    getDefaultEmbeddingConfigId,
    getDocumentEmbeddingConfigId,
    hasCustomEmbeddingConfig,
    createEmbeddingConfig,
    updateEmbeddingCandidates,
    deleteEmbeddingConfig,
    setDefaultEmbeddingConfigId,
    setDocumentEmbeddingConfigId,
    // 知识图谱配置相关
    getKgConfigs,
    getDefaultKgConfigId,
    createKgConfig,
    deleteKgConfig,
    updateKgConfig,
    setDefaultKgConfigId,
    ensureGraphTables
  }
})

/**
 * @file 知识图谱可视化 Store
 * @description 管理图谱数据加载状态、选中状态等
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type {
  GraphEntity,
  GraphRelation,
  LoadingProgress,
  GraphLoadState,
  GraphOption,
  NodeDetail
} from './types'
import {
  generateMockEntities,
  generateMockRelations
} from './graph-viewer.mock'
import { useKnowledgeLibraryStore } from '@renderer/stores/knowledge-library/knowledge-library.store'
import { useKnowledgeConfigStore } from '@renderer/stores/knowledge-library/knowledge-config.store'

export const useGraphViewerStore = defineStore('graph-viewer', () => {
  const knowledgeLibraryStore = useKnowledgeLibraryStore()
  const knowledgeConfigStore = useKnowledgeConfigStore()

  // ============ 状态 ============
  const loadState = ref<GraphLoadState>('idle')
  const progress = ref<LoadingProgress>({
    entitiesLoaded: 0,
    entitiesTotal: 0,
    relationsLoaded: 0,
    relationsTotal: 0
  })
  const entities = ref<GraphEntity[]>([])
  const relations = ref<GraphRelation[]>([])
  const entityTypes = ref<string[]>([])
  const errorMessage = ref<string | null>(null)

  // 选中状态
  const selectedGraphOption = ref<GraphOption | null>(null)
  const selectedNodeId = ref<string | null>(null)
  const hoveredNodeId = ref<string | null>(null)

  // 配置加载状态
  const configsLoading = ref(false)
  const loadedKbIds = ref<Set<number>>(new Set())

  // ============ 计算属性 ============

  /** 从知识库列表和配置中构建图谱选项 */
  const graphOptions = computed<GraphOption[]>(() => {
    const options: GraphOption[] = []
    for (const kb of knowledgeLibraryStore.knowledgeBases) {
      const kgConfigs = knowledgeConfigStore.getKgConfigs(kb.id)
      for (const cfg of kgConfigs) {
        if (cfg.graphTableBase && cfg.graphTablesCreated) {
          options.push({
            kbId: kb.id,
            kbName: kb.name,
            configId: cfg.id,
            configName: cfg.name,
            graphTableBase: cfg.graphTableBase,
            databaseName: kb.databaseName
          })
        }
      }
    }
    return options
  })

  const progressPercent = computed(() => {
    const { entitiesLoaded, entitiesTotal, relationsLoaded, relationsTotal } = progress.value
    const total = entitiesTotal + relationsTotal
    if (total === 0) return 0
    return Math.round(((entitiesLoaded + relationsLoaded) / total) * 100)
  })

  const selectedNodeDetail = computed<NodeDetail | null>(() => {
    if (!selectedNodeId.value) return null
    const entity = entities.value.find(e => e.id === selectedNodeId.value)
    if (!entity) return null
    const neighbors = new Set<string>()
    let degree = 0
    for (const rel of relations.value) {
      if (rel.source === entity.id) { neighbors.add(rel.target); degree++ }
      if (rel.target === entity.id) { neighbors.add(rel.source); degree++ }
    }
    return { id: entity.id, name: entity.name, type: entity.type, description: entity.description, degree, neighbors: Array.from(neighbors) }
  })

  // ============ 方法 ============

  async function loadAllConfigs(): Promise<void> {
    if (configsLoading.value) return
    configsLoading.value = true
    try {
      if (knowledgeLibraryStore.knowledgeBases.length === 0) {
        await knowledgeLibraryStore.fetchAll()
      }
      for (const kb of knowledgeLibraryStore.knowledgeBases) {
        if (!loadedKbIds.value.has(kb.id)) {
          await knowledgeConfigStore.loadConfig(kb.id)
          loadedKbIds.value.add(kb.id)
        }
      }
    } catch (err) {
      console.error('[GraphView] Failed to load configs:', err)
    } finally {
      configsLoading.value = false
    }
  }

  async function loadGraph(option: GraphOption): Promise<void> {
    selectedGraphOption.value = option
    loadState.value = 'loading'
    errorMessage.value = null
    entities.value = []
    relations.value = []
    entityTypes.value = []
    selectedNodeId.value = null
    hoveredNodeId.value = null

    try {
      // TODO: 替换为真实 IPC 调用
      const allEntities = generateMockEntities()
      const allRelations = generateMockRelations()

      progress.value = { entitiesLoaded: 0, entitiesTotal: allEntities.length, relationsLoaded: 0, relationsTotal: allRelations.length }

      const BATCH = 10
      for (let i = 0; i < allEntities.length; i += BATCH) {
        await sleep(80)
        entities.value.push(...allEntities.slice(i, i + BATCH))
        progress.value = { ...progress.value, entitiesLoaded: Math.min(i + BATCH, allEntities.length) }
      }
      for (let i = 0; i < allRelations.length; i += BATCH) {
        await sleep(60)
        relations.value.push(...allRelations.slice(i, i + BATCH))
        progress.value = { ...progress.value, relationsLoaded: Math.min(i + BATCH, allRelations.length) }
      }

      const types = new Set<string>()
      for (const e of entities.value) types.add(e.type)
      entityTypes.value = Array.from(types).sort()
      loadState.value = 'ready'
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : String(err)
      loadState.value = 'error'
    }
  }

  function selectNode(nodeId: string | null): void { selectedNodeId.value = nodeId }
  function hoverNode(nodeId: string | null): void { hoveredNodeId.value = nodeId }

  function reset(): void {
    loadState.value = 'idle'
    entities.value = []
    relations.value = []
    entityTypes.value = []
    errorMessage.value = null
    selectedGraphOption.value = null
    selectedNodeId.value = null
    hoveredNodeId.value = null
    progress.value = { entitiesLoaded: 0, entitiesTotal: 0, relationsLoaded: 0, relationsTotal: 0 }
  }

  watch(() => knowledgeLibraryStore.knowledgeBases, async (kbs) => {
    for (const kb of kbs) {
      if (!loadedKbIds.value.has(kb.id)) {
        await knowledgeConfigStore.loadConfig(kb.id)
        loadedKbIds.value.add(kb.id)
      }
    }
  }, { deep: true })

  return {
    loadState, progress, entities, relations, entityTypes, errorMessage,
    selectedGraphOption, selectedNodeId, hoveredNodeId, configsLoading,
    graphOptions, progressPercent, selectedNodeDetail,
    loadAllConfigs, loadGraph, selectNode, hoverNode, reset
  }
})

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

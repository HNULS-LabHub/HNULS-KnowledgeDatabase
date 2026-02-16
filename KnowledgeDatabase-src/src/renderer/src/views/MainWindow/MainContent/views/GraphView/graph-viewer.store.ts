/**
 * @file 知识图谱可视化 Store
 * @description 管理图谱数据加载状态、选中状态等
 */

import { defineStore } from 'pinia'
import { ref, computed, watch, onUnmounted } from 'vue'
import type {
  GraphEntity,
  GraphRelation,
  LoadingProgress,
  GraphLoadState,
  GraphOption,
  NodeDetail
} from './types'

/** 选中边的详情 */
export interface EdgeDetail {
  id: string
  sourceId: string
  sourceName: string
  targetId: string
  targetName: string
  keywords: string
  description: string
  weight: number
}
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
  const selectedEdgeId = ref<string | null>(null)  // 新增：选中的边
  const hoveredNodeId = ref<string | null>(null)

  // 配置加载状态
  const configsLoading = ref(false)
  const loadedKbIds = ref<Set<number>>(new Set())

  // 当前查询会话
  const currentSessionId = ref<string | null>(null)

  // 事件监听器清理函数
  const cleanupFns: (() => void)[] = []

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

  /** 选中边的详情 */
  const selectedEdgeDetail = computed<EdgeDetail | null>(() => {
    if (!selectedEdgeId.value) return null
    const rel = relations.value.find(r => r.id === selectedEdgeId.value)
    if (!rel) return null
    const sourceEntity = entities.value.find(e => e.id === rel.source)
    const targetEntity = entities.value.find(e => e.id === rel.target)
    return {
      id: rel.id,
      sourceId: rel.source,
      sourceName: sourceEntity?.name ?? rel.source,
      targetId: rel.target,
      targetName: targetEntity?.name ?? rel.target,
      keywords: rel.keywords,
      description: rel.description,
      weight: rel.weight
    }
  })

  /** 获取选中节点的关联边列表 */
  const selectedNodeEdges = computed<GraphRelation[]>(() => {
    if (!selectedNodeId.value) return []
    return relations.value.filter(
      r => r.source === selectedNodeId.value || r.target === selectedNodeId.value
    )
  })

  // ============ 方法 ============

  /** 初始化事件监听器 */
  function setupEventListeners(): void {
    // 清理旧的监听器
    cleanupEventListeners()

    const api = window.api.knowledgeGraph

    // 监听批次数据
    cleanupFns.push(api.onGraphDataBatch((data) => {
      // 只处理当前会话的数据
      if (data.sessionId !== currentSessionId.value) return

      // 追加实体
      if (data.entities.length > 0) {
        entities.value.push(...data.entities.map(e => ({
          id: e.id,
          name: e.name,
          type: e.type,
          description: e.description
        })))
      }

      // 追加关系
      if (data.relations.length > 0) {
        relations.value.push(...data.relations.map(r => ({
          id: r.id,
          source: r.source,
          target: r.target,
          keywords: r.keywords,
          description: r.description,
          weight: r.weight
        })))
      }

      // 更新进度
      progress.value = {
        entitiesLoaded: data.progress.entitiesLoaded,
        entitiesTotal: data.progress.entitiesTotal,
        relationsLoaded: data.progress.relationsLoaded,
        relationsTotal: data.progress.relationsTotal
      }

      // 更新实体类型
      updateEntityTypes()
    }))

    // 监听完成
    cleanupFns.push(api.onGraphDataComplete((sessionId) => {
      if (sessionId !== currentSessionId.value) return
      console.log('[GraphView] Query completed:', sessionId)
      
      // 如果数据为空，显示特殊状态
      if (entities.value.length === 0 && relations.value.length === 0) {
        errorMessage.value = '该知识图谱暂无数据，请先构建图谱'
        loadState.value = 'error'
      } else {
        loadState.value = 'ready'
      }
      currentSessionId.value = null
    }))

    // 监听错误
    cleanupFns.push(api.onGraphDataError((sessionId, error) => {
      if (sessionId !== currentSessionId.value) return
      console.error('[GraphView] Query error:', error)
      errorMessage.value = error
      loadState.value = 'error'
      currentSessionId.value = null
    }))

    // 监听取消
    cleanupFns.push(api.onGraphDataCancelled((sessionId) => {
      if (sessionId !== currentSessionId.value) return
      console.log('[GraphView] Query cancelled:', sessionId)
      // 取消时不改变状态，因为可能是切换图谱导致的
      currentSessionId.value = null
    }))
  }

  /** 清理事件监听器 */
  function cleanupEventListeners(): void {
    for (const cleanup of cleanupFns) {
      cleanup()
    }
    cleanupFns.length = 0
  }

  /** 更新实体类型列表 */
  function updateEntityTypes(): void {
    const types = new Set<string>()
    for (const e of entities.value) {
      if (e.type) types.add(e.type)
    }
    entityTypes.value = Array.from(types).sort()
  }

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
    // 取消当前查询
    cancelCurrentQuery()

    selectedGraphOption.value = option
    loadState.value = 'loading'
    errorMessage.value = null
    entities.value = []
    relations.value = []
    entityTypes.value = []
    selectedNodeId.value = null
    selectedEdgeId.value = null
    hoveredNodeId.value = null
    progress.value = { entitiesLoaded: 0, entitiesTotal: 0, relationsLoaded: 0, relationsTotal: 0 }

    // 确保事件监听器已设置
    setupEventListeners()

    try {
      // namespace 固定为 'knowledge'
      const NAMESPACE = 'knowledge'

      // 调用 IPC 开始流式查询
      const sessionId = await window.api.knowledgeGraph.queryGraphData({
        targetNamespace: NAMESPACE,
        targetDatabase: option.databaseName,
        graphTableBase: option.graphTableBase,
        batchSize: 100
      })

      currentSessionId.value = sessionId
      console.log('[GraphView] Query started:', sessionId)
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : String(err)
      loadState.value = 'error'
      console.error('[GraphView] Failed to start query:', err)
    }
  }

  /** 取消当前查询 */
  function cancelCurrentQuery(): void {
    if (currentSessionId.value) {
      window.api.knowledgeGraph.cancelGraphQuery(currentSessionId.value)
      currentSessionId.value = null
    }
  }

  function selectNode(nodeId: string | null): void {
    selectedNodeId.value = nodeId
    selectedEdgeId.value = null  // 选中节点时清除边选中
  }
  function selectEdge(edgeId: string | null): void {
    selectedEdgeId.value = edgeId
  }
  function hoverNode(nodeId: string | null): void { hoveredNodeId.value = nodeId }

  function reset(): void {
    cancelCurrentQuery()
    loadState.value = 'idle'
    entities.value = []
    relations.value = []
    entityTypes.value = []
    errorMessage.value = null
    selectedGraphOption.value = null
    selectedNodeId.value = null
    selectedEdgeId.value = null
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

  // 组件卸载时清理
  onUnmounted(() => {
    cancelCurrentQuery()
    cleanupEventListeners()
  })

  return {
    loadState, progress, entities, relations, entityTypes, errorMessage,
    selectedGraphOption, selectedNodeId, selectedEdgeId, hoveredNodeId, configsLoading,
    graphOptions, progressPercent, selectedNodeDetail, selectedEdgeDetail, selectedNodeEdges,
    loadAllConfigs, loadGraph, selectNode, selectEdge, hoverNode, reset
  }
})

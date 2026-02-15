<template>
  <div ref="containerRef" class="gv-sigma-renderer w-full h-full bg-slate-50" />
</template>

<script setup lang="ts">
/**
 * Sigma.js 图谱渲染器
 * 使用 Sigma.js + Graphology 实现高性能 WebGL 渲染
 * 
 * 布局流程：
 * 1. 圆形初始布局 (circular)
 * 2. ForceAtlas2 力导向布局 - 基于引力/斥力模型，让相连节点靠近，不相连节点远离
 * 3. Noverlap 防重叠 - 微调节点位置避免重叠
 * 4. 节点大小根据 degree centrality 调整 - 连接越多的节点越大
 * 
 * 边渲染：使用 @sigma/edge-curve 的贝塞尔曲线
 */

import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import Graph from 'graphology'
import Sigma from 'sigma'
import { circular } from 'graphology-layout'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import noverlap from 'graphology-layout-noverlap'
import { degreeCentrality } from 'graphology-metrics/centrality/degree'
import { EdgeCurvedArrowProgram, indexParallelEdgesIndex } from '@sigma/edge-curve'
import type { GraphEntity, GraphRelation } from './types'
import { buildColorMap, getTypeColor } from './color-palette'

const props = defineProps<{
  entities: GraphEntity[]
  relations: GraphRelation[]
  entityTypes: string[]
  selectedNodeId: string | null
  hoveredNodeId: string | null
}>()

const emit = defineEmits<{
  'select-node': [nodeId: string | null]
  'hover-node': [nodeId: string | null]
  'color-map-ready': [colorMap: Map<string, string>]
}>()

const containerRef = ref<HTMLElement | null>(null)

let graph: Graph | null = null
let sigma: Sigma | null = null
let colorMap = new Map<string, string>()

// ============ 构建图数据 ============

function buildGraph(entities: GraphEntity[], relations: GraphRelation[]): Graph {
  const g = new Graph({ multi: true }) // multi: true 允许平行边
  colorMap = buildColorMap(props.entityTypes)
  emit('color-map-ready', colorMap)

  // 添加节点
  for (const e of entities) {
    g.addNode(e.id, {
      label: e.name,
      entityType: e.type, // 注意：不能用 type，Sigma 会把它当作渲染类型
      description: e.description,
      color: getTypeColor(colorMap, e.type),
      size: 5
    })
  }

  // 添加边
  for (const r of relations) {
    if (g.hasNode(r.source) && g.hasNode(r.target)) {
      g.addEdge(r.source, r.target, {
        weight: r.weight,
        label: r.keywords,
        color: 'rgba(160, 160, 160, 0.5)',
        size: 1,
        type: 'curvedArrow' // 使用曲线箭头
      })
    }
  }

  // 为平行边计算曲率索引（让多条边之间的边弯曲程度不同）
  indexParallelEdgesIndex(g, { edgeIndexAttribute: 'parallelIndex', edgeMaxIndexAttribute: 'parallelMaxIndex' })

  return g
}

// ============ 布局计算 ============

function applyLayout(g: Graph): void {
  // 1. 初始圆形布局
  circular.assign(g, { scale: 300 })

  // 2. ForceAtlas2 力导向布局
  // - gravity: 向中心的引力，防止图散开
  // - scalingRatio: 斥力缩放，值越大节点越分散
  // - barnesHutOptimize: 大图优化，使用 Barnes-Hut 近似算法
  // - adjustSizes: 考虑节点大小避免重叠
  forceAtlas2.assign(g, {
    iterations: 200,
    settings: {
      gravity: 1,
      scalingRatio: 2,
      barnesHutOptimize: g.order > 100,
      strongGravityMode: false,
      slowDown: 5,
      adjustSizes: true
    }
  })

  // 3. Noverlap 防重叠微调
  noverlap.assign(g, {
    maxIterations: 100,
    settings: {
      margin: 5,
      ratio: 1.5
    }
  })

  // 4. 根据 degree centrality 调整节点大小
  const degrees = degreeCentrality(g)
  const maxDegree = Math.max(1, ...Object.values(degrees))

  g.forEachNode((node) => {
    const d = degrees[node] ?? 0
    const size = 4 + (d / maxDegree) * 16
    g.setNodeAttribute(node, 'size', size)
  })
}

// ============ Sigma 渲染器 ============

function createSigma(g: Graph): Sigma | null {
  if (!containerRef.value) return null

  const s = new Sigma(g, containerRef.value, {
    renderLabels: true,
    labelRenderedSizeThreshold: 6,
    labelDensity: 0.5,
    labelGridCellSize: 100,
    labelFont: 'system-ui, sans-serif',
    labelSize: 12,
    labelWeight: 'normal',
    labelColor: { color: '#334155' },
    defaultNodeColor: '#94a3b8',
    defaultEdgeColor: 'rgba(160, 160, 160, 0.5)',
    defaultEdgeType: 'curvedArrow', // 默认使用曲线箭头
    minCameraRatio: 0.1,
    maxCameraRatio: 5,
    zIndex: true,
    enableEdgeEvents: false,
    // 注册曲线边渲染程序
    edgeProgramClasses: {
      curvedArrow: EdgeCurvedArrowProgram
    }
  })

  // 悬停效果
  s.on('enterNode', ({ node }) => {
    emit('hover-node', node)
  })

  s.on('leaveNode', () => {
    emit('hover-node', null)
  })

  // 点击选中
  s.on('clickNode', ({ node }) => {
    emit('select-node', node)
  })

  s.on('clickStage', () => {
    emit('select-node', null)
  })

  return s
}

// ============ 高亮效果 ============

function updateHighlight(): void {
  if (!sigma || !graph) return

  const activeNode = props.selectedNodeId ?? props.hoveredNodeId
  const activeNeighbors = new Set<string>()

  if (activeNode && graph.hasNode(activeNode)) {
    graph.forEachNeighbor(activeNode, (neighbor) => {
      activeNeighbors.add(neighbor)
    })
  }

  sigma.setSetting('nodeReducer', (node, data) => {
    if (!activeNode) return data

    const isActive = node === activeNode
    const isNeighbor = activeNeighbors.has(node)

    if (isActive) {
      return { ...data, highlighted: true, zIndex: 2 }
    }
    if (isNeighbor) {
      return { ...data, zIndex: 1 }
    }
    return { ...data, color: 'rgba(200, 200, 200, 0.4)', label: '', zIndex: 0 }
  })

  sigma.setSetting('edgeReducer', (edge, data) => {
    if (!activeNode || !graph) return data

    const source = graph.source(edge)
    const target = graph.target(edge)
    const isActive = source === activeNode || target === activeNode

    if (isActive) {
      return { ...data, color: 'rgba(91, 143, 249, 0.8)', size: 2, zIndex: 1 }
    }
    return { ...data, color: 'rgba(200, 200, 200, 0.1)', zIndex: 0 }
  })

  sigma.refresh()
}

// ============ 生命周期 ============

function initGraph(): void {
  if (props.entities.length === 0) return

  console.log('[GraphView] Building graph:', props.entities.length, 'nodes,', props.relations.length, 'edges')

  if (sigma) {
    sigma.kill()
    sigma = null
  }

  graph = buildGraph(props.entities, props.relations)
  applyLayout(graph)
  sigma = createSigma(graph)

  if (sigma) {
    sigma.getCamera().animatedReset({ duration: 300 })
  }
}

onMounted(() => {
  if (props.entities.length > 0) {
    nextTick(() => initGraph())
  }
})

onBeforeUnmount(() => {
  if (sigma) {
    sigma.kill()
    sigma = null
  }
  graph = null
})

watch(
  () => [props.entities, props.relations] as const,
  ([ents]) => {
    if (ents.length > 0) {
      nextTick(() => initGraph())
    }
  },
  { deep: true }
)

watch(
  () => [props.selectedNodeId, props.hoveredNodeId],
  () => updateHighlight()
)
</script>

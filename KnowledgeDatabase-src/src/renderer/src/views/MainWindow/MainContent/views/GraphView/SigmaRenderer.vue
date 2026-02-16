<template>
  <div ref="containerRef" class="gv-sigma-renderer w-full h-full bg-slate-50">
    <!-- 布局状态指示器 -->
    <div
      v-if="layoutRunning"
      class="absolute bottom-3 right-3 z-10 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-lg border border-slate-200 shadow-sm flex items-center gap-2"
    >
      <span class="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
      <span class="text-xs text-slate-600">布局优化中...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Sigma.js 图谱渲染器
 * 使用 Sigma.js + Graphology 实现高性能 WebGL 渲染
 * 
 * 布局流程：
 * 1. CirclePack 气泡图布局 - 按实体类型分组
 * 2. ForceAtlas2 力导向布局（Web Worker 异步）- 优化节点位置
 * 3. Noverlap 防重叠 - 微调节点位置避免重叠
 * 4. 节点大小根据 degree centrality 调整
 * 
 * 边渲染：使用 @sigma/edge-curve 的贝塞尔曲线
 */

import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import Graph from 'graphology'
import Sigma from 'sigma'
import { circlepack } from 'graphology-layout'
import FA2Layout from 'graphology-layout-forceatlas2/worker'
import { inferSettings } from 'graphology-layout-forceatlas2'
import noverlap from 'graphology-layout-noverlap'
import { degreeCentrality } from 'graphology-metrics/centrality/degree'
import { EdgeCurvedArrowProgram, indexParallelEdgesIndex } from '@sigma/edge-curve'
import type { GraphEntity, GraphRelation } from './types'
import { buildColorMap, getTypeColor, blendColors } from './color-palette'

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
const layoutRunning = ref(false)

let graph: Graph | null = null
let sigma: Sigma | null = null
let fa2Layout: FA2Layout | null = null
let colorMap = new Map<string, string>()

// ============ 构建图数据 ============

function buildGraph(entities: GraphEntity[], relations: GraphRelation[]): Graph {
  const g = new Graph({ multi: true }) // multi: true 允许平行边
  colorMap = buildColorMap(props.entityTypes)
  emit('color-map-ready', colorMap)

  // 构建实体 ID -> 类型 的映射，用于边颜色计算
  const entityTypeMap = new Map<string, string>()
  for (const e of entities) {
    entityTypeMap.set(e.id, e.type)
  }

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

  // 添加边 - 存储两端颜色信息，选中时才显示渐变色
  for (const r of relations) {
    if (g.hasNode(r.source) && g.hasNode(r.target)) {
      const sourceType = entityTypeMap.get(r.source) ?? ''
      const targetType = entityTypeMap.get(r.target) ?? ''
      const sourceColor = getTypeColor(colorMap, sourceType)
      const targetColor = getTypeColor(colorMap, targetType)

      g.addEdge(r.source, r.target, {
        weight: r.weight,
        label: r.keywords,
        color: '#bfdbfe', // 常态浅蓝色
        sourceColor, // 存储用于高亮时计算
        targetColor,
        size: 1,
        type: 'curvedArrow'
      })
    }
  }

  // 为平行边计算曲率索引（让多条边之间的边弯曲程度不同）
  indexParallelEdgesIndex(g, { edgeIndexAttribute: 'parallelIndex', edgeMaxIndexAttribute: 'parallelMaxIndex' })

  return g
}

// ============ 布局计算 ============

function applyInitialLayout(g: Graph): void {
  // 1. CirclePack 气泡图布局 - 按实体类型分组，scale 大让分布更分散
  circlepack.assign(g, {
    hierarchyAttributes: ['entityType'],
    scale: 5000 // 较大的 scale 让布局更分散
  })

  // 2. 根据 degree centrality 调整节点大小
  const degrees = degreeCentrality(g)
  const maxDegree = Math.max(1, ...Object.values(degrees))

  g.forEachNode((node) => {
    const d = degrees[node] ?? 0
    const size = 4 + (d / maxDegree) * 16
    g.setNodeAttribute(node, 'size', size)
  })
}

function startAsyncLayout(g: Graph): void {
  // 清理旧的 Worker
  if (fa2Layout) {
    fa2Layout.kill()
    fa2Layout = null
  }

  // 根据图规模推断合适的参数
  const sensibleSettings = inferSettings(g)

  fa2Layout = new FA2Layout(g, {
    settings: {
      ...sensibleSettings,
      gravity: 0.5,           // 较小的引力，让图更分散
      scalingRatio: 100,       // 较大的斥力缩放，节点更分散
      barnesHutOptimize: g.order > 50,
      strongGravityMode: false,
      slowDown: 2,
      adjustSizes: true
    }
  })

  layoutRunning.value = true
  fa2Layout.start()

  // 最多运行 3 秒后停止
  setTimeout(() => {
    stopAsyncLayout()
  }, 3000)
}

function stopAsyncLayout(): void {
  if (fa2Layout?.isRunning()) {
    fa2Layout.stop()
  }
  layoutRunning.value = false

  // 最后做一次 noverlap 防重叠微调
  if (graph) {
    noverlap.assign(graph, {
      maxIterations: 50,
      settings: {
        margin: 8,
        ratio: 2
      }
    })
    sigma?.refresh()
  }
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
    defaultEdgeColor: '#bfdbfe',
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

  // 悬停效果 - 已禁用，仅点击触发高亮
  // s.on('enterNode', ({ node }) => {
  //   emit('hover-node', node)
  // })

  // s.on('leaveNode', () => {
  //   emit('hover-node', null)
  // })

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

  // 仅响应点击选中，不响应悬停
  const activeNode = props.selectedNodeId
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
    // 非活跃节点：缩小 + 灰色滤镜效果
    const size = typeof data.size === 'number' ? data.size * 0.5 : 3
    return { ...data, color: '#d1d5db', size, label: '', zIndex: 0 }
  })

  sigma.setSetting('edgeReducer', (edge, data) => {
    if (!activeNode || !graph) return data

    const source = graph.source(edge)
    const target = graph.target(edge)
    const isActive = source === activeNode || target === activeNode

    if (isActive) {
      // 选中时显示渐变色（两端节点颜色混合），加粗
      const sourceColor = graph.getEdgeAttribute(edge, 'sourceColor') as string
      const targetColor = graph.getEdgeAttribute(edge, 'targetColor') as string
      const blendedColor = blendColors(sourceColor, targetColor, 0.5)
      return { ...data, color: blendedColor, size: 3, zIndex: 1 }
    }
    // 非活跃边：灰色滤镜
    return { ...data, color: '#e5e7eb', size: 0.5, zIndex: 0 }
  })

  sigma.refresh()
}

// ============ 生命周期 ============

function initGraph(): void {
  if (props.entities.length === 0) return

  console.log('[GraphView] Building graph:', props.entities.length, 'nodes,', props.relations.length, 'edges')

  // 清理旧的
  stopAsyncLayout()
  if (fa2Layout) {
    fa2Layout.kill()
    fa2Layout = null
  }
  if (sigma) {
    sigma.kill()
    sigma = null
  }

  graph = buildGraph(props.entities, props.relations)
  
  // 1. 先应用初始布局（同步，很快）
  applyInitialLayout(graph)
  
  // 2. 创建渲染器，让用户先看到初始状态
  sigma = createSigma(graph)

  if (sigma) {
    sigma.getCamera().animatedReset({ duration: 300 })
  }

  // 3. 启动异步布局优化
  startAsyncLayout(graph)
}

onMounted(() => {
  if (props.entities.length > 0) {
    nextTick(() => initGraph())
  }
})

onBeforeUnmount(() => {
  stopAsyncLayout()
  if (fa2Layout) {
    fa2Layout.kill()
    fa2Layout = null
  }
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

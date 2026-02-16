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
 * 1. 随机初始位置 + 按类型预聚类
 * 2. ForceAtlas2 力导向布局（Web Worker 异步）
 * 3. Noverlap 防重叠微调
 * 4. 节点大小根据 degree centrality 调整
 * 
 * 边渲染：使用 @sigma/edge-curve 的贝塞尔曲线
 */

import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import Graph from 'graphology'
import Sigma from 'sigma'
import FA2Layout from 'graphology-layout-forceatlas2/worker'
import { inferSettings } from 'graphology-layout-forceatlas2'
import noverlap from 'graphology-layout-noverlap'
import { createNodeBorderProgram } from '@sigma/node-border'
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

/**
 * 有机布局 (Organic Layout)
 * 
 * 核心特点：
 * 1. 聚类之间距离很远（好几倍直径的间隔）
 * 2. 跨类型关联的节点分散在聚类之间的空白区域（像桥梁一样）
 * 3. 纯聚类内节点保持在聚类内部，稀疏分布
 * 4. 节点间距根据节点大小动态计算，至少 3 倍半径
 */
function applyInitialLayout(g: Graph): void {
  // ========== 先计算节点大小（关联数越多越大） ==========
  const nodeSizes = new Map<string, number>()
  g.forEachNode((node) => {
    const degree = g.degree(node)
    const size = 4 + Math.sqrt(degree) * 2.5  // 基础 4，按度数平方根增长
    nodeSizes.set(node, size)
    g.setNodeAttribute(node, 'size', size)
  })

  // 节点间距系数：3 倍半径
  const SPACING_RATIO = 8

  // 按类型分组
  const typeGroups = new Map<string, string[]>()
  g.forEachNode((node, attrs) => {
    const type = attrs.entityType as string
    if (!typeGroups.has(type)) typeGroups.set(type, [])
    typeGroups.get(type)!.push(node)
  })

  const types = Array.from(typeGroups.keys())
  if (types.length === 0) return

  // 计算每个聚类的平均节点大小
  const clusterAvgSize = new Map<string, number>()
  types.forEach(type => {
    const nodes = typeGroups.get(type)!
    const totalSize = nodes.reduce((sum, n) => sum + (nodeSizes.get(n) ?? 6), 0)
    clusterAvgSize.set(type, totalSize / nodes.length)
  })
  
  // ========== 第一步：计算聚类中心位置（间隔很远） ==========
  const clusterCenters = new Map<string, { x: number; y: number; size: number }>()
  
  types.forEach((type, i) => {
    const nodes = typeGroups.get(type)!
    const count = nodes.length
    const avgSize = clusterAvgSize.get(type) ?? 6
    // 聚类半径根据节点数和平均大小计算
    const clusterRadius = Math.sqrt(count) * avgSize * SPACING_RATIO * 1.2
    const angle = (i / types.length) * 2 * Math.PI
    const angleJitter = (Math.random() - 0.5) * 0.8
    const radiusJitter = (Math.random() - 0.5) * 300
    const distFromCenter = 600 + clusterRadius * 3 + radiusJitter
    clusterCenters.set(type, {
      x: distFromCenter * Math.cos(angle + angleJitter),
      y: distFromCenter * Math.sin(angle + angleJitter),
      size: clusterRadius
    })
  })

  // 聚类间力导向迭代 - 保证聚类间距至少 4 倍直径
  for (let iter = 0; iter < 40; iter++) {
    const forces = new Map<string, { fx: number; fy: number }>()
    types.forEach(t => forces.set(t, { fx: 0, fy: 0 }))

    for (let i = 0; i < types.length; i++) {
      for (let j = i + 1; j < types.length; j++) {
        const c1 = clusterCenters.get(types[i])!
        const c2 = clusterCenters.get(types[j])!
        const dx = c2.x - c1.x
        const dy = c2.y - c1.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        
        const minDist = (c1.size + c2.size) * 2 * 4
        
        if (dist < minDist) {
          const overlap = minDist - dist
          const force = overlap * 2
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          
          forces.get(types[i])!.fx -= fx
          forces.get(types[i])!.fy -= fy
          forces.get(types[j])!.fx += fx
          forces.get(types[j])!.fy += fy
        }
      }
    }

    types.forEach(type => {
      const c = clusterCenters.get(type)!
      const f = forces.get(type)!
      f.fx -= c.x * 0.01
      f.fy -= c.y * 0.01
    })

    types.forEach(type => {
      const c = clusterCenters.get(type)!
      const f = forces.get(type)!
      c.x += f.fx * 0.4
      c.y += f.fy * 0.4
    })
  }

  // 聚类中心随机扰动
  types.forEach(type => {
    const c = clusterCenters.get(type)!
    c.x += (Math.random() - 0.5) * c.size * 0.6
    c.y += (Math.random() - 0.5) * c.size * 0.6
  })

  // ========== 预计算：每个节点的跨类型邻居 ==========
  const crossTypeNeighbors = new Map<string, Set<string>>()
  
  g.forEachNode((node, attrs) => {
    const myType = attrs.entityType as string
    const neighborTypes = new Set<string>()
    
    g.forEachNeighbor(node, (_neighbor, neighborAttrs) => {
      const nType = neighborAttrs.entityType as string
      if (nType !== myType) {
        neighborTypes.add(nType)
      }
    })
    
    if (neighborTypes.size > 0) {
      crossTypeNeighbors.set(node, neighborTypes)
    }
  })

  // ========== 第二步：放置节点（根据节点大小动态计算间距） ==========
  // 空间分区网格，用于快速查找附近节点（避免 O(n²) 检查）
  const GRID_SIZE = 50  // 网格大小
  const spatialGrid = new Map<string, Array<{ id: string; x: number; y: number; size: number }>>()
  
  const getGridKey = (x: number, y: number): string => {
    const gx = Math.floor(x / GRID_SIZE)
    const gy = Math.floor(y / GRID_SIZE)
    return `${gx},${gy}`
  }
  
  const addToGrid = (node: { id: string; x: number; y: number; size: number }): void => {
    const key = getGridKey(node.x, node.y)
    if (!spatialGrid.has(key)) spatialGrid.set(key, [])
    spatialGrid.get(key)!.push(node)
  }
  
  const getNearbyNodes = (x: number, y: number, radius: number): Array<{ id: string; x: number; y: number; size: number }> => {
    const result: Array<{ id: string; x: number; y: number; size: number }> = []
    const cellRadius = Math.ceil(radius / GRID_SIZE) + 1
    const cx = Math.floor(x / GRID_SIZE)
    const cy = Math.floor(y / GRID_SIZE)
    
    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        const key = `${cx + dx},${cy + dy}`
        const cell = spatialGrid.get(key)
        if (cell) result.push(...cell)
      }
    }
    return result
  }

  // 尝试放置节点，避免与已放置节点重叠
  const tryPlaceNode = (
    node: string,
    baseX: number,
    baseY: number,
    maxAttempts: number = 12
  ): { x: number; y: number } => {
    const nodeSize = nodeSizes.get(node) ?? 6
    const searchRadius = nodeSize * SPACING_RATIO * 3
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const jitterScale = 1 + attempt * 0.8
      const x = baseX + (Math.random() - 0.5) * nodeSize * SPACING_RATIO * jitterScale
      const y = baseY + (Math.random() - 0.5) * nodeSize * SPACING_RATIO * jitterScale
      
      // 只检查附近的节点
      const nearby = getNearbyNodes(x, y, searchRadius)
      let hasOverlap = false
      
      for (const placed of nearby) {
        const dx = x - placed.x
        const dy = y - placed.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const minDist = (nodeSize + placed.size) * SPACING_RATIO / 2
        
        if (dist < minDist) {
          hasOverlap = true
          break
        }
      }
      
      if (!hasOverlap) {
        return { x, y }
      }
    }
    
    // 所有尝试都失败，向外推开
    const pushAngle = Math.random() * 2 * Math.PI
    const pushDist = nodeSize * SPACING_RATIO * 4
    return {
      x: baseX + Math.cos(pushAngle) * pushDist,
      y: baseY + Math.sin(pushAngle) * pushDist
    }
  }

  // 收集所有节点并按大小排序（大节点优先放置）
  const allNodes: Array<{ node: string; type: string; isBridge: boolean }> = []
  
  types.forEach(type => {
    const nodes = typeGroups.get(type)!
    nodes.forEach(node => {
      allNodes.push({
        node,
        type,
        isBridge: crossTypeNeighbors.has(node)
      })
    })
  })
  
  // 按大小降序排序
  allNodes.sort((a, b) => (nodeSizes.get(b.node) ?? 0) - (nodeSizes.get(a.node) ?? 0))

  // 记录每个聚类的当前螺旋状态
  const clusterSpiralState = new Map<string, { radius: number; angleOffset: number; count: number }>()
  types.forEach(type => {
    const avgSize = clusterAvgSize.get(type) ?? 6
    clusterSpiralState.set(type, {
      radius: avgSize * SPACING_RATIO,
      angleOffset: 0,
      count: 0
    })
  })

  // 按大小顺序放置所有节点
  allNodes.forEach(({ node, type, isBridge }) => {
    const center = clusterCenters.get(type)!
    const nodeSize = nodeSizes.get(node) ?? 6
    
    let baseX: number, baseY: number
    
    if (isBridge) {
      // 桥梁节点：放到聚类之间
      const neighborTypes = crossTypeNeighbors.get(node)!
      let sumX = center.x, sumY = center.y, weight = 1
      
      neighborTypes.forEach(neighborType => {
        const neighborCenter = clusterCenters.get(neighborType)
        if (neighborCenter) {
          sumX += neighborCenter.x
          sumY += neighborCenter.y
          weight++
        }
      })
      
      const avgX = sumX / weight
      const avgY = sumY / weight
      const dirX = avgX - center.x
      const dirY = avgY - center.y
      const dirLen = Math.sqrt(dirX * dirX + dirY * dirY) || 1
      
      // 距离：从聚类边缘到目标方向的 70%
      const dist = center.size * 1.2 + Math.random() * (dirLen * 0.5)
      const perpX = -dirY / dirLen
      const perpY = dirX / dirLen
      const perpOffset = (Math.random() - 0.5) * 300
      
      baseX = center.x + (dirX / dirLen) * dist + perpX * perpOffset
      baseY = center.y + (dirY / dirLen) * dist + perpY * perpOffset
    } else {
      // 纯内部节点：螺旋分布
      const state = clusterSpiralState.get(type)!
      const circumference = 2 * Math.PI * state.radius
      const nodesPerRing = Math.max(1, Math.floor(circumference / (nodeSize * SPACING_RATIO)))
      const ringIndex = state.count % nodesPerRing
      
      const theta = state.angleOffset + (ringIndex / nodesPerRing) * 2 * Math.PI
      baseX = center.x + state.radius * Math.cos(theta)
      baseY = center.y + state.radius * Math.sin(theta)
      
      state.count++
      if (ringIndex === nodesPerRing - 1) {
        state.radius += nodeSize * SPACING_RATIO
        state.angleOffset += 0.5
      }
    }
    
    const pos = tryPlaceNode(node, baseX, baseY)
    g.setNodeAttribute(node, 'x', pos.x)
    g.setNodeAttribute(node, 'y', pos.y)
    addToGrid({ id: node, x: pos.x, y: pos.y, size: nodeSize })
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
      gravity: 0.02,           // 轻微向心力，保持聚类结构
      scalingRatio: 15,        // 适中斥力，微调而不破坏布局
      barnesHutOptimize: g.order > 100,
      barnesHutTheta: 0.6,
      strongGravityMode: false,
      slowDown: 1,
      adjustSizes: true,
      linLogMode: false
    }
  })

  layoutRunning.value = true
  fa2Layout.start()

  // 有机布局已经很好了，只需要短时间微调
  const duration = Math.min(2000, Math.max(1000, g.order))
  setTimeout(() => {
    stopAsyncLayout()
  }, duration)
}

function stopAsyncLayout(): void {
  if (fa2Layout?.isRunning()) {
    fa2Layout.stop()
  }
  layoutRunning.value = false

  // 轻量 noverlap 防重叠微调（考虑节点大小）
  if (graph) {
    noverlap.assign(graph, {
      maxIterations: 15,
      settings: {
        margin: 2,
        ratio: 1.2,
        gridSize: 20
      }
    })
    sigma?.refresh()
  }
}

// ============ Sigma 渲染器 ============

function createSigma(g: Graph): Sigma | null {
  if (!containerRef.value) return null

  // 白色边框 + 颜色填充的节点程序
  const NodeBorderProgram = createNodeBorderProgram({
    borders: [
      { size: { value: 0.15 }, color: { value: '#ffffff' } },
      { size: { fill: true }, color: { attribute: 'color' } }
    ]
  })

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
    defaultEdgeType: 'curvedArrow',
    defaultNodeType: 'border',
    minCameraRatio: 0.1,
    maxCameraRatio: 5,
    zIndex: true,
    enableEdgeEvents: false,
    nodeProgramClasses: {
      border: NodeBorderProgram
    },
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

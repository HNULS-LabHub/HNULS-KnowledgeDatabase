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
 * 1. 有机布局（Organic Layout）：按类型聚类 + 桥梁节点分离
 * 2. ForceAtlas2 力导向微调（Web Worker 异步）
 * 3. Noverlap 防重叠微调
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

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                           布局配置区 (Layout Config)                          ║
// ║  所有布局相关参数集中在此，方便调参和理解各参数的作用                              ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

const LAYOUT_CONFIG = {
  // ═══════════════════════════════════════════════════════════════════════════
  // 节点大小配置
  // ═══════════════════════════════════════════════════════════════════════════
  nodeSize: {
    base: 4, // 基础大小（度数为0时的大小）
    degreeScale: 2.5 // 度数缩放系数：size = base + sqrt(degree) * degreeScale
    // 影响：值越大，高度数节点与低度数节点的大小差异越明显
    // 互相影响：会影响 spacing.ratio 的实际效果（大节点需要更大间距）
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 节点间距配置
  // ═══════════════════════════════════════════════════════════════════════════
  spacing: {
    ratio: 6, // 节点间距系数：最小间距 = (size1 + size2) * ratio / 2
    // 影响：值越大，节点之间越稀疏
    // 建议范围：2-5，太小会重叠，太大会过于稀疏
    // 互相影响：与 nodeSize 共同决定实际间距

    gridSize: 50 // 空间分区网格大小（用于快速查找附近节点）
    // 影响：值越小，查找越精确但内存占用越大
    // 建议范围：30-100，通常不需要调整
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 聚类配置（按实体类型分组）
  // ═══════════════════════════════════════════════════════════════════════════
  cluster: {
    radiusScale: 1.2, // 聚类半径缩放：radius = sqrt(count) * avgSize * spacing.ratio * radiusScale
    // 影响：值越大，聚类内部越稀疏
    // 互相影响：与 spacing.ratio 共同决定聚类大小

    baseDistance: 1500, // 聚类中心到原点的基础距离（最小聚类的距离）
    // 影响：值越大，整体图越大
    // 调大原因：800 太小，聚类初始位置太近

    distanceScale: 8, // 聚类距离缩放：distance = baseDistance + clusterRadius * distanceScale
    // 影响：值越大，大聚类离中心越远，聚类之间间隔越大
    // 关键参数：这个值决定了聚类之间的间隔
    // 调大原因：5 不够，大聚类需要更远的距离

    angleJitter: 0.3, // 聚类角度随机扰动范围（弧度）
    // 影响：值越大，聚类分布越不规则
    // 建议范围：0-1.0
    // 调小原因：0.6 太大可能导致相邻聚类角度重叠

    radiusJitter: 300, // 聚类距离随机扰动范围
    // 影响：值越大，聚类距离中心的距离变化越大

    centerJitter: 0.2 // 聚类中心最终随机扰动（相对于聚类半径的比例）
    // 影响：值越大，聚类位置越随机
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 聚类间斥力配置
  // ═══════════════════════════════════════════════════════════════════════════
  clusterRepulsion: {
    iterations: 100, // 聚类间力导向迭代次数
    // 影响：值越大，聚类分离越彻底，但计算时间越长
    // 建议范围：20-150
    // 调大原因：60 次可能不够完全分开

    minDistanceScale: 10, // 聚类间最小距离系数：minDist = (r1 + r2) * 2 * minDistanceScale
    // 影响：值越大，聚类之间间隔越远
    // 关键参数：这个值直接决定聚类间的最小间隔
    // 建议范围：6-15
    // 调大原因：6 不够，需要更大间隔

    forceScale: 5, // 斥力强度系数
    // 影响：值越大，重叠时推开的力越强
    // 建议范围：1-8
    // 调大原因：3 推力不够强

    damping: 0.4, // 力的阻尼系数（每次迭代位移 = 力 * damping）
    // 影响：值越大，收敛越快但可能不稳定
    // 建议范围：0.3-0.6

    gravity: 0.001 // 向心力系数（防止聚类飞太远）
    // 影响：值越大，聚类越靠近中心
    // 建议范围：0.0005-0.01
    // 调小原因：0.005 太大，会把聚类拉回中心
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 桥梁节点配置（跨类型连接的节点）
  // ═══════════════════════════════════════════════════════════════════════════
  bridge: {
    minDistanceScale: 1.5, // 桥梁节点到聚类中心的最小距离（相对于聚类半径）
    // 影响：值越大，桥梁节点离自己聚类越远

    maxDistanceRatio: 0.75, // 桥梁节点最大距离（相对于到目标聚类的距离）
    // 影响：值越大，桥梁节点可以走得越远
    // 问题修复：之前 0.3 太小，导致都挤在中间

    perpOffset: 400, // 垂直方向随机偏移范围
    // 影响：值越大，桥梁节点在垂直方向分布越广

    pickRandomTarget: true // 当连接多个聚类时，随机选一个目标方向（而不是平均）
    // 影响：true 时桥梁节点会分散到不同方向，避免都挤在中心
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 节点放置配置
  // ═══════════════════════════════════════════════════════════════════════════
  placement: {
    maxAttempts: 12, // 放置节点时的最大尝试次数
    // 影响：值越大，越不容易重叠，但计算时间越长
    // 建议范围：8-20

    jitterGrowth: 0.8, // 每次尝试失败后，随机范围增长系数
    // 影响：值越大，失败后搜索范围扩大越快

    pushDistance: 4, // 所有尝试失败后，向外推开的距离（相对于 spacing.ratio）
    // 影响：值越大，失败时推得越远

    spiralAngleOffset: 0.5 // 螺旋布局每圈的角度偏移（弧度）
    // 影响：值越大，螺旋越不规则
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ForceAtlas2 微调配置
  // ═══════════════════════════════════════════════════════════════════════════
  forceAtlas2: {
    enabled: true, // 是否启用 ForceAtlas2 微调

    gravity: 0.02, // 向心力：值越大，节点越往中心聚拢
    // 影响：太大会破坏聚类结构，太小没效果
    // 建议范围：0.01-0.1

    scalingRatio: 15, // 斥力缩放：值越大，节点互相推开越强
    // 影响：太大会把聚类打散，太小没效果
    // 建议范围：5-50
    // 互相影响：与 gravity 需要平衡

    barnesHutTheta: 0.6, // Barnes-Hut 近似精度：值越大越快但越不精确
    // 影响：0.5-0.8 是常用范围

    adjustSizes: true, // 是否考虑节点大小
    // 影响：true 时大节点会有更大的斥力

    linLogMode: false, // 线性-对数模式：true 时分布更均匀
    // 影响：对于聚类图，false 通常更好

    minDuration: 1000, // 最小运行时间（毫秒）
    maxDuration: 2000 // 最大运行时间（毫秒）
    // 实际时间 = clamp(nodeCount, minDuration, maxDuration)
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Noverlap 防重叠配置
  // ═══════════════════════════════════════════════════════════════════════════
  noverlap: {
    enabled: true, // 是否启用 noverlap

    maxIterations: 15, // 最大迭代次数
    // 影响：值越大，防重叠越彻底，但计算时间越长
    // 警告：超过 20 在大图上会很慢
    // 建议范围：10-20

    margin: 2, // 节点间额外边距
    // 影响：值越大，节点之间留白越多

    ratio: 1.2, // 节点大小缩放比例（用于计算碰撞）
    // 影响：值越大，认为节点越大，推开越多

    gridSize: 20 // 空间分区网格大小
    // 影响：值越小越精确但越慢
  }
}

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                              组件逻辑开始                                      ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

const props = defineProps<{
  entities: GraphEntity[]
  relations: GraphRelation[]
  entityTypes: string[]
  selectedNodeId: string | null
  selectedEdgeId: string | null
  hoveredNodeId: string | null
}>()

const emit = defineEmits<{
  'select-node': [nodeId: string | null]
  'select-edge': [edgeId: string | null]
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
  const g = new Graph({ multi: true })
  colorMap = buildColorMap(props.entityTypes)
  emit('color-map-ready', colorMap)

  const entityTypeMap = new Map<string, string>()
  for (const e of entities) {
    entityTypeMap.set(e.id, e.type)
  }

  for (const e of entities) {
    g.addNode(e.id, {
      label: e.name,
      entityType: e.type,
      description: e.description,
      color: getTypeColor(colorMap, e.type),
      size: 5
    })
  }

  for (const r of relations) {
    if (g.hasNode(r.source) && g.hasNode(r.target)) {
      const sourceType = entityTypeMap.get(r.source) ?? ''
      const targetType = entityTypeMap.get(r.target) ?? ''
      const sourceColor = getTypeColor(colorMap, sourceType)
      const targetColor = getTypeColor(colorMap, targetType)

      g.addEdgeWithKey(r.id, r.source, r.target, {
        relationId: r.id,
        weight: r.weight,
        label: r.keywords,
        keywords: r.keywords,
        description: r.description,
        color: '#bfdbfe',
        sourceColor,
        targetColor,
        size: 1,
        type: 'curvedArrow'
      })
    }
  }

  indexParallelEdgesIndex(g, {
    edgeIndexAttribute: 'parallelIndex',
    edgeMaxIndexAttribute: 'parallelMaxIndex'
  })
  return g
}

// ============ 有机布局 ============

function applyInitialLayout(g: Graph): void {
  const cfg = LAYOUT_CONFIG

  // 计算节点大小
  const nodeSizes = new Map<string, number>()
  g.forEachNode((node) => {
    const degree = g.degree(node)
    const size = cfg.nodeSize.base + Math.sqrt(degree) * cfg.nodeSize.degreeScale
    nodeSizes.set(node, size)
    g.setNodeAttribute(node, 'size', size)
  })

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
  types.forEach((type) => {
    const nodes = typeGroups.get(type)!
    const totalSize = nodes.reduce((sum, n) => sum + (nodeSizes.get(n) ?? 6), 0)
    clusterAvgSize.set(type, totalSize / nodes.length)
  })

  // ========== 第一步：计算聚类中心位置 ==========
  const clusterCenters = new Map<string, { x: number; y: number; size: number }>()

  types.forEach((type, i) => {
    const nodes = typeGroups.get(type)!
    const count = nodes.length
    const avgSize = clusterAvgSize.get(type) ?? 6
    const clusterRadius = Math.sqrt(count) * avgSize * cfg.spacing.ratio * cfg.cluster.radiusScale
    const angle = (i / types.length) * 2 * Math.PI
    const angleJitter = (Math.random() - 0.5) * cfg.cluster.angleJitter
    const radiusJitter = (Math.random() - 0.5) * cfg.cluster.radiusJitter
    const distFromCenter =
      cfg.cluster.baseDistance + clusterRadius * cfg.cluster.distanceScale + radiusJitter
    clusterCenters.set(type, {
      x: distFromCenter * Math.cos(angle + angleJitter),
      y: distFromCenter * Math.sin(angle + angleJitter),
      size: clusterRadius
    })
  })

  // 聚类间力导向迭代
  for (let iter = 0; iter < cfg.clusterRepulsion.iterations; iter++) {
    const forces = new Map<string, { fx: number; fy: number }>()
    types.forEach((t) => forces.set(t, { fx: 0, fy: 0 }))

    for (let i = 0; i < types.length; i++) {
      for (let j = i + 1; j < types.length; j++) {
        const c1 = clusterCenters.get(types[i])!
        const c2 = clusterCenters.get(types[j])!
        const dx = c2.x - c1.x
        const dy = c2.y - c1.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const minDist = (c1.size + c2.size) * 2 * cfg.clusterRepulsion.minDistanceScale

        if (dist < minDist) {
          const overlap = minDist - dist
          const force = overlap * cfg.clusterRepulsion.forceScale
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          forces.get(types[i])!.fx -= fx
          forces.get(types[i])!.fy -= fy
          forces.get(types[j])!.fx += fx
          forces.get(types[j])!.fy += fy
        }
      }
    }

    types.forEach((type) => {
      const c = clusterCenters.get(type)!
      const f = forces.get(type)!
      f.fx -= c.x * cfg.clusterRepulsion.gravity
      f.fy -= c.y * cfg.clusterRepulsion.gravity
    })

    types.forEach((type) => {
      const c = clusterCenters.get(type)!
      const f = forces.get(type)!
      c.x += f.fx * cfg.clusterRepulsion.damping
      c.y += f.fy * cfg.clusterRepulsion.damping
    })
  }

  // 聚类中心随机扰动
  types.forEach((type) => {
    const c = clusterCenters.get(type)!
    c.x += (Math.random() - 0.5) * c.size * cfg.cluster.centerJitter
    c.y += (Math.random() - 0.5) * c.size * cfg.cluster.centerJitter
  })

  // ========== 预计算跨类型邻居 ==========
  const crossTypeNeighbors = new Map<string, Set<string>>()
  g.forEachNode((node, attrs) => {
    const myType = attrs.entityType as string
    const neighborTypes = new Set<string>()
    g.forEachNeighbor(node, (_neighbor, neighborAttrs) => {
      const nType = neighborAttrs.entityType as string
      if (nType !== myType) neighborTypes.add(nType)
    })
    if (neighborTypes.size > 0) crossTypeNeighbors.set(node, neighborTypes)
  })

  // ========== 第二步：放置节点 ==========
  const spatialGrid = new Map<string, Array<{ id: string; x: number; y: number; size: number }>>()

  const getGridKey = (x: number, y: number): string => {
    const gx = Math.floor(x / cfg.spacing.gridSize)
    const gy = Math.floor(y / cfg.spacing.gridSize)
    return `${gx},${gy}`
  }

  const addToGrid = (node: { id: string; x: number; y: number; size: number }): void => {
    const key = getGridKey(node.x, node.y)
    if (!spatialGrid.has(key)) spatialGrid.set(key, [])
    spatialGrid.get(key)!.push(node)
  }

  const getNearbyNodes = (x: number, y: number, radius: number) => {
    const result: Array<{ id: string; x: number; y: number; size: number }> = []
    const cellRadius = Math.ceil(radius / cfg.spacing.gridSize) + 1
    const cx = Math.floor(x / cfg.spacing.gridSize)
    const cy = Math.floor(y / cfg.spacing.gridSize)
    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        const cell = spatialGrid.get(`${cx + dx},${cy + dy}`)
        if (cell) result.push(...cell)
      }
    }
    return result
  }

  const tryPlaceNode = (node: string, baseX: number, baseY: number): { x: number; y: number } => {
    const nodeSize = nodeSizes.get(node) ?? 6
    const searchRadius = nodeSize * cfg.spacing.ratio * 3

    for (let attempt = 0; attempt < cfg.placement.maxAttempts; attempt++) {
      const jitterScale = 1 + attempt * cfg.placement.jitterGrowth
      const x = baseX + (Math.random() - 0.5) * nodeSize * cfg.spacing.ratio * jitterScale
      const y = baseY + (Math.random() - 0.5) * nodeSize * cfg.spacing.ratio * jitterScale

      const nearby = getNearbyNodes(x, y, searchRadius)
      let hasOverlap = false
      for (const placed of nearby) {
        const dx = x - placed.x
        const dy = y - placed.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const minDist = ((nodeSize + placed.size) * cfg.spacing.ratio) / 2
        if (dist < minDist) {
          hasOverlap = true
          break
        }
      }
      if (!hasOverlap) return { x, y }
    }

    const pushAngle = Math.random() * 2 * Math.PI
    const pushDist = nodeSize * cfg.spacing.ratio * cfg.placement.pushDistance
    return { x: baseX + Math.cos(pushAngle) * pushDist, y: baseY + Math.sin(pushAngle) * pushDist }
  }

  // 收集并排序所有节点
  const allNodes: Array<{ node: string; type: string; isBridge: boolean }> = []
  types.forEach((type) => {
    typeGroups.get(type)!.forEach((node) => {
      allNodes.push({ node, type, isBridge: crossTypeNeighbors.has(node) })
    })
  })
  allNodes.sort((a, b) => (nodeSizes.get(b.node) ?? 0) - (nodeSizes.get(a.node) ?? 0))

  // 螺旋状态
  const clusterSpiralState = new Map<
    string,
    { radius: number; angleOffset: number; count: number }
  >()
  types.forEach((type) => {
    const avgSize = clusterAvgSize.get(type) ?? 6
    clusterSpiralState.set(type, { radius: avgSize * cfg.spacing.ratio, angleOffset: 0, count: 0 })
  })

  // 放置节点
  allNodes.forEach(({ node, type, isBridge }) => {
    const center = clusterCenters.get(type)!
    const nodeSize = nodeSizes.get(node) ?? 6
    let baseX: number, baseY: number

    if (isBridge) {
      const neighborTypes = crossTypeNeighbors.get(node)!
      const neighborTypeArray = Array.from(neighborTypes)

      let targetX: number, targetY: number

      if (cfg.bridge.pickRandomTarget && neighborTypeArray.length > 0) {
        // 随机选择一个目标聚类方向（避免都挤在中心）
        const randomTarget = neighborTypeArray[Math.floor(Math.random() * neighborTypeArray.length)]
        const targetCenter = clusterCenters.get(randomTarget)
        if (targetCenter) {
          targetX = targetCenter.x
          targetY = targetCenter.y
        } else {
          targetX = center.x
          targetY = center.y
        }
      } else {
        // 使用所有目标的平均位置
        let sumX = 0,
          sumY = 0,
          count = 0
        neighborTypeArray.forEach((neighborType) => {
          const neighborCenter = clusterCenters.get(neighborType)
          if (neighborCenter) {
            sumX += neighborCenter.x
            sumY += neighborCenter.y
            count++
          }
        })
        targetX = count > 0 ? sumX / count : center.x
        targetY = count > 0 ? sumY / count : center.y
      }

      const dirX = targetX - center.x,
        dirY = targetY - center.y
      const dirLen = Math.sqrt(dirX * dirX + dirY * dirY) || 1
      const dist =
        center.size * cfg.bridge.minDistanceScale +
        Math.random() * (dirLen * cfg.bridge.maxDistanceRatio)
      const perpX = -dirY / dirLen,
        perpY = dirX / dirLen
      const perpOffset = (Math.random() - 0.5) * cfg.bridge.perpOffset
      baseX = center.x + (dirX / dirLen) * dist + perpX * perpOffset
      baseY = center.y + (dirY / dirLen) * dist + perpY * perpOffset
    } else {
      const state = clusterSpiralState.get(type)!
      const circumference = 2 * Math.PI * state.radius
      const nodesPerRing = Math.max(1, Math.floor(circumference / (nodeSize * cfg.spacing.ratio)))
      const ringIndex = state.count % nodesPerRing
      const theta = state.angleOffset + (ringIndex / nodesPerRing) * 2 * Math.PI
      baseX = center.x + state.radius * Math.cos(theta)
      baseY = center.y + state.radius * Math.sin(theta)
      state.count++
      if (ringIndex === nodesPerRing - 1) {
        state.radius += nodeSize * cfg.spacing.ratio
        state.angleOffset += cfg.placement.spiralAngleOffset
      }
    }

    const pos = tryPlaceNode(node, baseX, baseY)
    g.setNodeAttribute(node, 'x', pos.x)
    g.setNodeAttribute(node, 'y', pos.y)
    addToGrid({ id: node, x: pos.x, y: pos.y, size: nodeSize })
  })
}

// ============ ForceAtlas2 微调 ============

function startAsyncLayout(g: Graph): void {
  const cfg = LAYOUT_CONFIG.forceAtlas2
  if (!cfg.enabled) {
    applyNoverlap()
    return
  }

  if (fa2Layout) {
    fa2Layout.kill()
    fa2Layout = null
  }

  const sensibleSettings = inferSettings(g)
  fa2Layout = new FA2Layout(g, {
    settings: {
      ...sensibleSettings,
      gravity: cfg.gravity,
      scalingRatio: cfg.scalingRatio,
      barnesHutOptimize: g.order > 100,
      barnesHutTheta: cfg.barnesHutTheta,
      strongGravityMode: false,
      slowDown: 1,
      adjustSizes: cfg.adjustSizes,
      linLogMode: cfg.linLogMode
    }
  })

  layoutRunning.value = true
  fa2Layout.start()

  const duration = Math.min(cfg.maxDuration, Math.max(cfg.minDuration, g.order))
  setTimeout(() => stopAsyncLayout(), duration)
}

function stopAsyncLayout(): void {
  if (fa2Layout?.isRunning()) fa2Layout.stop()
  layoutRunning.value = false
  applyNoverlap()
}

function applyNoverlap(): void {
  const cfg = LAYOUT_CONFIG.noverlap
  if (!cfg.enabled || !graph) return

  noverlap.assign(graph, {
    maxIterations: cfg.maxIterations,
    settings: { margin: cfg.margin, ratio: cfg.ratio, gridSize: cfg.gridSize }
  })
  sigma?.refresh()
}

// ============ Sigma 渲染器 ============

function createSigma(g: Graph): Sigma | null {
  if (!containerRef.value) return null

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
    renderEdgeLabels: false, // 默认不渲染边标签，由 forceLabel 控制
    edgeLabelSize: 10,
    edgeLabelFont: 'system-ui, sans-serif',
    edgeLabelColor: { color: '#3b82f6' },
    defaultNodeColor: '#94a3b8',
    defaultEdgeColor: '#bfdbfe',
    defaultEdgeType: 'curvedArrow',
    defaultNodeType: 'border',
    minCameraRatio: 0.1,
    maxCameraRatio: 5,
    zIndex: true,
    enableEdgeEvents: true,
    // 拖拽与点击区分设置
    dragTimeout: 150, // 拖拽超时（ms），稍微放宽避免误判
    draggedEventsTolerance: 5, // 允许更多 mousemove 事件仍算点击
    nodeProgramClasses: { border: NodeBorderProgram },
    edgeProgramClasses: { curvedArrow: EdgeCurvedArrowProgram }
  })

  s.on('clickNode', ({ node }) => emit('select-node', node))
  s.on('clickEdge', ({ edge }) => {
    if (props.selectedNodeId && graph) {
      const source = graph.source(edge)
      const target = graph.target(edge)
      if (source === props.selectedNodeId || target === props.selectedNodeId) {
        emit('select-edge', graph.getEdgeAttribute(edge, 'relationId') as string)
      }
    }
  })
  s.on('clickStage', () => emit('select-node', null))

  return s
}

// ============ 高亮效果 ============

function updateHighlight(): void {
  if (!sigma || !graph) return

  const activeNode = props.selectedNodeId
  const activeNeighbors = new Set<string>()
  if (activeNode && graph.hasNode(activeNode)) {
    graph.forEachNeighbor(activeNode, (neighbor) => activeNeighbors.add(neighbor))
  }

  sigma.setSetting('nodeReducer', (node, data) => {
    if (!activeNode) return data
    const isActive = node === activeNode
    const isNeighbor = activeNeighbors.has(node)
    if (isActive) return { ...data, highlighted: true, zIndex: 2 }
    if (isNeighbor) return { ...data, zIndex: 1 }
    const size = typeof data.size === 'number' ? data.size * 0.5 : 3
    return { ...data, color: '#d1d5db', size, label: '', zIndex: 0 }
  })

  sigma.setSetting('edgeReducer', (edge, data) => {
    // 没有选中节点时，隐藏所有边标签
    if (!activeNode || !graph) {
      return { ...data, forceLabel: false, label: '' }
    }

    const source = graph.source(edge)
    const target = graph.target(edge)
    const isActive = source === activeNode || target === activeNode
    const isSelectedEdge = graph.getEdgeAttribute(edge, 'relationId') === props.selectedEdgeId

    if (isActive) {
      // 选中节点的关联边：高亮 + 显示标签
      const sourceColor = graph.getEdgeAttribute(edge, 'sourceColor') as string
      const targetColor = graph.getEdgeAttribute(edge, 'targetColor') as string
      const blendedColor = blendColors(sourceColor, targetColor, 0.5)
      return {
        ...data,
        color: isSelectedEdge ? '#2563eb' : blendedColor,
        size: isSelectedEdge ? 4 : 3,
        zIndex: isSelectedEdge ? 2 : 1,
        forceLabel: true
      }
    }
    // 非关联边：淡化 + 隐藏标签
    return { ...data, color: '#e5e7eb', size: 0.5, zIndex: 0, forceLabel: false, label: '' }
  })

  sigma.refresh()
}

// ============ 生命周期 ============

function initGraph(): void {
  if (props.entities.length === 0) return
  console.log(
    '[GraphView] Building graph:',
    props.entities.length,
    'nodes,',
    props.relations.length,
    'edges'
  )

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
  applyInitialLayout(graph)
  sigma = createSigma(graph)
  if (sigma) sigma.getCamera().animatedReset({ duration: 300 })
  startAsyncLayout(graph)
}

onMounted(() => {
  if (props.entities.length > 0) nextTick(() => initGraph())
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
    if (ents.length > 0) nextTick(() => initGraph())
  },
  { deep: true }
)

watch(
  () => [props.selectedNodeId, props.selectedEdgeId, props.hoveredNodeId],
  () => updateHighlight()
)
</script>

<template>
  <div class="ts-sigma-layout-test flex h-full bg-slate-100">
    <!-- 左侧控制面板 -->
    <div class="ts-control-panel w-[280px] flex-shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
      <div class="p-4 border-b border-slate-100">
        <h2 class="text-sm font-semibold text-slate-800">Sigma 布局测试</h2>
        <p class="text-xs text-slate-500 mt-1">10,000 节点 · 10,000 边</p>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <!-- 布局选择 -->
        <section class="space-y-2">
          <label class="text-xs font-semibold text-slate-600">布局算法</label>
          <div class="space-y-1">
            <button
              v-for="layout in layouts"
              :key="layout.id"
              class="w-full px-3 py-2 text-left text-xs rounded-lg border transition-all"
              :class="currentLayout === layout.id 
                ? 'bg-blue-50 border-blue-300 text-blue-700' 
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'"
              @click="switchLayout(layout.id)"
            >
              <div class="font-medium">{{ layout.name }}</div>
              <div class="text-[10px] opacity-70 mt-0.5">{{ layout.description }}</div>
            </button>
          </div>
        </section>

        <!-- 布局状态 -->
        <section v-if="layoutState !== 'idle'" class="space-y-2">
          <label class="text-xs font-semibold text-slate-600">布局状态</label>
          <div class="p-3 bg-slate-50 rounded-lg">
            <div class="flex items-center gap-2">
              <span
                class="w-2 h-2 rounded-full"
                :class="{
                  'bg-amber-500 animate-pulse': layoutState === 'running',
                  'bg-emerald-500': layoutState === 'done',
                  'bg-red-500': layoutState === 'error'
                }"
              />
              <span class="text-xs text-slate-600">
                {{ layoutState === 'running' ? '布局计算中...' : layoutState === 'done' ? '布局完成' : '布局错误' }}
              </span>
            </div>
            <div v-if="layoutTime > 0" class="text-[10px] text-slate-500 mt-1">
              耗时: {{ layoutTime }}ms
            </div>
          </div>
        </section>

        <!-- 图统计 -->
        <section class="space-y-2">
          <label class="text-xs font-semibold text-slate-600">图统计</label>
          <div class="grid grid-cols-2 gap-2">
            <div class="p-2 bg-slate-50 rounded-lg">
              <div class="text-lg font-bold text-slate-800">{{ nodeCount.toLocaleString() }}</div>
              <div class="text-[10px] text-slate-500">节点</div>
            </div>
            <div class="p-2 bg-slate-50 rounded-lg">
              <div class="text-lg font-bold text-slate-800">{{ edgeCount.toLocaleString() }}</div>
              <div class="text-[10px] text-slate-500">边</div>
            </div>
          </div>
        </section>

        <!-- 操作按钮 -->
        <section class="space-y-2">
          <button
            class="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            :disabled="layoutState === 'running'"
            @click="regenerateGraph"
          >
            重新生成图数据
          </button>
          <button
            class="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-lg transition-colors"
            @click="resetCamera"
          >
            重置视角
          </button>
        </section>
      </div>
    </div>

    <!-- 右侧渲染区 -->
    <div class="flex-1 relative">
      <div ref="containerRef" class="w-full h-full" />
      
      <!-- 布局运行指示器 -->
      <div
        v-if="layoutState === 'running'"
        class="absolute bottom-4 right-4 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-lg border border-slate-200 shadow-sm flex items-center gap-2"
      >
        <span class="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        <span class="text-xs text-slate-600">{{ currentLayoutName }} 布局优化中...</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'
import Graph from 'graphology'
import Sigma from 'sigma'
import { circular } from 'graphology-layout'
import FA2Layout from 'graphology-layout-forceatlas2/worker'
import { inferSettings } from 'graphology-layout-forceatlas2'
import noverlap from 'graphology-layout-noverlap'
import { createNodeBorderProgram } from '@sigma/node-border'
import { EdgeCurvedArrowProgram, indexParallelEdgesIndex } from '@sigma/edge-curve'

// ============ 类型定义 ============

type LayoutId = 'organic' | 'grid-cluster' | 'radial-tree' | 'force-cluster' | 'concentric-rings'
type LayoutState = 'idle' | 'running' | 'done' | 'error'

interface LayoutOption {
  id: LayoutId
  name: string
  description: string
}

// ============ 布局配置 ============

const layouts: LayoutOption[] = [
  { id: 'organic', name: '有机布局', description: '两级力导向，聚类清晰分离' },
  { id: 'grid-cluster', name: '网格聚类', description: '按类型分组的网格布局' },
  { id: 'radial-tree', name: '径向树', description: '从中心向外辐射的层级布局' },
  { id: 'force-cluster', name: '力导向聚类', description: 'ForceAtlas2 + 类型聚类' },
  { id: 'concentric-rings', name: '同心环', description: '按度数分层的同心圆布局' }
]

// ============ 状态 ============

const containerRef = ref<HTMLElement | null>(null)
const currentLayout = ref<LayoutId>('organic')
const layoutState = ref<LayoutState>('idle')
const layoutTime = ref(0)
const nodeCount = ref(0)
const edgeCount = ref(0)

let graph: Graph | null = null
let sigma: Sigma | null = null
let fa2Layout: FA2Layout | null = null

const currentLayoutName = computed(() => layouts.find(l => l.id === currentLayout.value)?.name ?? '')

// ============ 颜色配置 ============

// 偏白的柔和颜色（不使用 alpha）
const TYPE_COLORS = [
  '#93c5fd',   // blue-300
  '#6ee7b7',   // emerald-300
  '#fcd34d',   // amber-300
  '#fca5a5',   // red-300
  '#c4b5fd',   // violet-300
  '#f9a8d4',   // pink-300
  '#67e8f9',   // cyan-300
  '#bef264',   // lime-300
  '#fdba74',   // orange-300
  '#a5b4fc'    // indigo-300
]

// ============ 数据生成 ============

function generateTestGraph(): Graph {
  const g = new Graph({ multi: true })
  const NODE_COUNT = 10000
  const EDGE_COUNT = 10000
  const TYPE_COUNT = 10

  // 生成节点
  for (let i = 0; i < NODE_COUNT; i++) {
    const typeIndex = Math.floor(Math.random() * TYPE_COUNT)
    g.addNode(`n${i}`, {
      label: `Node ${i}`,
      entityType: `Type${typeIndex}`,
      color: TYPE_COLORS[typeIndex],
      borderColor: '#ffffff',
      size: 3,
      x: 0,
      y: 0
    })
  }

  // 生成边 - 每个节点连接 1-20 条边
  const nodes = g.nodes()
  let edgesAdded = 0
  const maxEdgesPerNode = new Map<string, number>()

  // 预分配每个节点的最大边数
  for (const node of nodes) {
    maxEdgesPerNode.set(node, 1 + Math.floor(Math.random() * 20))
  }

  // 添加边直到达到目标数量
  while (edgesAdded < EDGE_COUNT) {
    const sourceIdx = Math.floor(Math.random() * NODE_COUNT)
    const targetIdx = Math.floor(Math.random() * NODE_COUNT)
    
    if (sourceIdx === targetIdx) continue

    const source = nodes[sourceIdx]
    const target = nodes[targetIdx]

    // 检查是否超过最大边数
    const sourceDegree = g.degree(source)
    const targetDegree = g.degree(target)
    const sourceMax = maxEdgesPerNode.get(source) ?? 10
    const targetMax = maxEdgesPerNode.get(target) ?? 10

    if (sourceDegree >= sourceMax || targetDegree >= targetMax) continue

    g.addEdge(source, target, {
      color: '#e2e8f0',
      size: 0.5,
      type: 'curvedArrow'
    })
    edgesAdded++
  }

  // 根据度数调整节点大小
  g.forEachNode((node) => {
    const degree = g.degree(node)
    const size = 2 + Math.sqrt(degree) * 1.5
    g.setNodeAttribute(node, 'size', size)
  })

  // 为平行边计算曲率
  indexParallelEdgesIndex(g, { edgeIndexAttribute: 'parallelIndex', edgeMaxIndexAttribute: 'parallelMaxIndex' })

  nodeCount.value = g.order
  edgeCount.value = g.size

  return g
}

// ============ 常量：节点间距至少 25 倍半径 ============
const MIN_SPACING_RATIO = 25  // 节点间距 = 节点半径 * 25
const AVG_NODE_SIZE = 4       // 平均节点大小
const BASE_SPACING = AVG_NODE_SIZE * MIN_SPACING_RATIO  // 基础间距 = 100

// ============ 布局算法 ============

/**
 * 有机布局 (Organic Layout)
 * 
 * 核心特点：
 * 1. 聚类之间距离很远（好几倍直径的间隔）
 * 2. 跨类型关联的节点直接放到聚类之间的空白区域（像桥梁一样）
 * 3. 纯聚类内节点保持在聚类内部，稀疏分布
 */
async function applyOrganicLayout(g: Graph): Promise<void> {
  // 按类型分组
  const typeGroups = new Map<string, string[]>()
  g.forEachNode((node, attrs) => {
    const type = attrs.entityType as string
    if (!typeGroups.has(type)) typeGroups.set(type, [])
    typeGroups.get(type)!.push(node)
  })

  const types = Array.from(typeGroups.keys())
  
  // ========== 第一步：计算聚类中心位置（间隔很远） ==========
  const clusterCenters = new Map<string, { x: number; y: number; size: number }>()
  
  types.forEach((type, i) => {
    const count = typeGroups.get(type)!.length
    const clusterRadius = Math.sqrt(count) * 35  // 聚类本身紧凑
    const angle = (i / types.length) * 2 * Math.PI
    // 随机扰动
    const angleJitter = (Math.random() - 0.5) * 0.8
    const radiusJitter = (Math.random() - 0.5) * 300
    // 聚类中心距离原点很远，保证聚类间有大量空白
    const distFromCenter = 800 + clusterRadius * 4 + radiusJitter
    clusterCenters.set(type, {
      x: distFromCenter * Math.cos(angle + angleJitter),
      y: distFromCenter * Math.sin(angle + angleJitter),
      size: clusterRadius
    })
  })

  // 聚类间力导向迭代 - 保证聚类间距至少 5 倍直径
  const iterations = 50
  
  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map<string, { fx: number; fy: number }>()
    types.forEach(t => forces.set(t, { fx: 0, fy: 0 }))

    for (let i = 0; i < types.length; i++) {
      for (let j = i + 1; j < types.length; j++) {
        const c1 = clusterCenters.get(types[i])!
        const c2 = clusterCenters.get(types[j])!
        const dx = c2.x - c1.x
        const dy = c2.y - c1.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        
        // 最小距离 = 两个聚类直径之和 * 5（非常远）
        const minDist = (c1.size + c2.size) * 2 * 5
        
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

    // 轻微向心力
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
    c.x += (Math.random() - 0.5) * c.size * 0.8
    c.y += (Math.random() - 0.5) * c.size * 0.8
  })

  // ========== 预计算：每个节点的跨类型邻居 ==========
  const crossTypeNeighbors = new Map<string, Set<string>>()  // node -> Set<neighborType>
  
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

  // ========== 第二步：放置节点 ==========
  types.forEach(type => {
    const nodes = typeGroups.get(type)!
    const center = clusterCenters.get(type)!
    const count = nodes.length

    // 分离：纯内部节点 vs 跨类型节点
    const pureNodes: string[] = []
    const bridgeNodes: string[] = []
    
    nodes.forEach(node => {
      if (crossTypeNeighbors.has(node)) {
        bridgeNodes.push(node)
      } else {
        pureNodes.push(node)
      }
    })

    // 纯内部节点：放在聚类内部，稀疏分布
    const pureCount = pureNodes.length
    pureNodes.forEach((node, i) => {
      const maxR = center.size * 0.9
      const rRatio = Math.sqrt((i + 1) / (pureCount || 1))
      let r = maxR * rRatio
      
      // 随机扰动
      const theta = Math.random() * 2 * Math.PI
      const jitterR = (Math.random() - 0.5) * center.size * 0.5
      r = Math.max(5, r + jitterR)
      
      const x = center.x + r * Math.cos(theta)
      const y = center.y + r * Math.sin(theta)
      
      g.setNodeAttribute(node, 'x', x)
      g.setNodeAttribute(node, 'y', y)
    })

    // 跨类型节点：在聚类之间的广阔空白区域分散分布
    const bridgeCount = bridgeNodes.length
    bridgeNodes.forEach((node, idx) => {
      const neighborTypes = crossTypeNeighbors.get(node)!
      const neighborTypeArray = Array.from(neighborTypes)
      
      // 计算所有关联聚类中心的平均位置
      let sumX = center.x
      let sumY = center.y
      let weight = 1
      
      neighborTypeArray.forEach(neighborType => {
        const neighborCenter = clusterCenters.get(neighborType)
        if (neighborCenter) {
          sumX += neighborCenter.x
          sumY += neighborCenter.y
          weight++
        }
      })
      
      const avgX = sumX / weight
      const avgY = sumY / weight
      
      // 计算从自己聚类中心到平均位置的方向
      const dirX = avgX - center.x
      const dirY = avgY - center.y
      const dirLen = Math.sqrt(dirX * dirX + dirY * dirY) || 1
      
      // 在整个空白区域分散放置
      // 距离范围：从聚类边缘到接近目标聚类
      const minDist = center.size * 1.2
      const maxDist = dirLen * 0.85  // 最远到 85% 的距离
      const distRange = maxDist - minDist
      
      // 使用更大的分散系数
      const t = bridgeCount > 1 ? idx / (bridgeCount - 1) : 0.5
      const baseDistance = minDist + distRange * t
      
      // 垂直方向大幅偏移
      const perpX = -dirY / dirLen
      const perpY = dirX / dirLen
      const perpRange = 200 + distRange * 0.3  // 垂直方向偏移范围
      const perpOffset = (Math.random() - 0.5) * perpRange * 2
      
      let x = center.x + (dirX / dirLen) * baseDistance + perpX * perpOffset
      let y = center.y + (dirY / dirLen) * baseDistance + perpY * perpOffset
      
      // 额外大幅随机扰动
      x += (Math.random() - 0.5) * 150
      y += (Math.random() - 0.5) * 150
      
      g.setNodeAttribute(node, 'x', x)
      g.setNodeAttribute(node, 'y', y)
    })
  })

  // ========== 第三步：轻量 ForceAtlas2 微调 ==========
  return new Promise((resolve) => {
    if (fa2Layout) {
      fa2Layout.kill()
      fa2Layout = null
    }

    const settings = inferSettings(g)
    fa2Layout = new FA2Layout(g, {
      settings: {
        ...settings,
        gravity: 0.02,
        scalingRatio: 15,
        barnesHutOptimize: true,
        barnesHutTheta: 0.6,
        adjustSizes: true,
        strongGravityMode: false,
        linLogMode: false
      }
    })

    fa2Layout.start()

    setTimeout(() => {
      if (fa2Layout?.isRunning()) {
        fa2Layout.stop()
      }
      noverlap.assign(g, { maxIterations: 10, settings: { margin: 8, ratio: 1.3 } })
      resolve()
    }, 1500)
  })
}

/** 布局1: 网格聚类 - 按类型分组排列成网格，直接保证间距 */
function applyGridClusterLayout(g: Graph): void {
  const typeGroups = new Map<string, string[]>()
  
  g.forEachNode((node, attrs) => {
    const type = attrs.entityType as string
    if (!typeGroups.has(type)) typeGroups.set(type, [])
    typeGroups.get(type)!.push(node)
  })

  const types = Array.from(typeGroups.keys())
  const gridCols = Math.ceil(Math.sqrt(types.length))
  const nodeSpacing = BASE_SPACING
  const cellSize = nodeSpacing * 110

  types.forEach((type, typeIdx) => {
    const nodes = typeGroups.get(type)!
    const gridX = typeIdx % gridCols
    const gridY = Math.floor(typeIdx / gridCols)
    const centerX = gridX * cellSize
    const centerY = gridY * cellSize

    const nodesPerRow = Math.ceil(Math.sqrt(nodes.length))
    nodes.forEach((node, i) => {
      const localX = (i % nodesPerRow) * nodeSpacing
      const localY = Math.floor(i / nodesPerRow) * nodeSpacing
      g.setNodeAttribute(node, 'x', centerX + localX - (nodesPerRow * nodeSpacing) / 2)
      g.setNodeAttribute(node, 'y', centerY + localY - (nodesPerRow * nodeSpacing) / 2)
    })
  })
}

/** 布局2: 径向树 - 从中心向外辐射，每层节点数根据周长计算 */
function applyRadialTreeLayout(g: Graph): void {
  const typeGroups = new Map<string, string[]>()
  
  g.forEachNode((node, attrs) => {
    const type = attrs.entityType as string
    if (!typeGroups.has(type)) typeGroups.set(type, [])
    typeGroups.get(type)!.push(node)
  })

  const types = Array.from(typeGroups.keys())
  const angleStep = (2 * Math.PI) / types.length
  const layerGap = BASE_SPACING * 1.2

  types.forEach((type, typeIdx) => {
    const nodes = typeGroups.get(type)!
    const baseAngle = typeIdx * angleStep
    const spreadAngle = angleStep * 0.85

    const sortedNodes = [...nodes].sort((n1, n2) => g.degree(n2) - g.degree(n1))

    let nodeIdx = 0
    let layer = 1
    
    while (nodeIdx < sortedNodes.length) {
      const radius = BASE_SPACING * 2 + layer * layerGap
      // 该层在扇形内能放多少节点
      const arcLength = radius * spreadAngle
      const nodesInLayer = Math.max(1, Math.floor(arcLength / BASE_SPACING))
      
      for (let i = 0; i < nodesInLayer && nodeIdx < sortedNodes.length; i++) {
        const angle = baseAngle - spreadAngle / 2 + (i + 0.5) / nodesInLayer * spreadAngle
        g.setNodeAttribute(sortedNodes[nodeIdx], 'x', radius * Math.cos(angle))
        g.setNodeAttribute(sortedNodes[nodeIdx], 'y', radius * Math.sin(angle))
        nodeIdx++
      }
      layer++
    }
  })
}

/** 布局4: 力导向聚类 - ForceAtlas2 异步，轻量 noverlap */
async function applyForceClusterLayout(g: Graph): Promise<void> {
  circular.assign(g, { scale: BASE_SPACING * 40 })

  const typeGroups = new Map<string, string[]>()
  g.forEachNode((node, attrs) => {
    const type = attrs.entityType as string
    if (!typeGroups.has(type)) typeGroups.set(type, [])
    typeGroups.get(type)!.push(node)
  })

  const types = Array.from(typeGroups.keys())
  const angleStep = (2 * Math.PI) / types.length
  const clusterRadius = BASE_SPACING * 25

  types.forEach((type, typeIdx) => {
    const nodes = typeGroups.get(type)!
    const centerAngle = typeIdx * angleStep
    const centerX = clusterRadius * Math.cos(centerAngle)
    const centerY = clusterRadius * Math.sin(centerAngle)

    nodes.forEach((node) => {
      const currentX = g.getNodeAttribute(node, 'x') as number
      const currentY = g.getNodeAttribute(node, 'y') as number
      g.setNodeAttribute(node, 'x', currentX * 0.3 + centerX)
      g.setNodeAttribute(node, 'y', currentY * 0.3 + centerY)
    })
  })

  return new Promise((resolve) => {
    if (fa2Layout) {
      fa2Layout.kill()
      fa2Layout = null
    }

    const settings = inferSettings(g)
    fa2Layout = new FA2Layout(g, {
      settings: {
        ...settings,
        gravity: 0.05,
        scalingRatio: 200,
        barnesHutOptimize: true,
        barnesHutTheta: 0.6,
        adjustSizes: true,
        strongGravityMode: false
      }
    })

    fa2Layout.start()

    setTimeout(() => {
      if (fa2Layout?.isRunning()) {
        fa2Layout.stop()
      }
      // 轻量 noverlap：只做 10 次迭代
      noverlap.assign(g, { maxIterations: 10, settings: { margin: BASE_SPACING * 0.5, ratio: 1.5 } })
      resolve()
    }, 3000)
  })
}

/** 布局5: 同心环 - 按度数分层，半径根据节点数动态计算 */
function applyConcentricRingsLayout(g: Graph): void {
  const nodes = g.nodes()
  
  const degreeGroups = new Map<number, string[]>()
  let maxDegree = 0

  nodes.forEach((node) => {
    const degree = g.degree(node)
    maxDegree = Math.max(maxDegree, degree)
    if (!degreeGroups.has(degree)) degreeGroups.set(degree, [])
    degreeGroups.get(degree)!.push(node)
  })

  const layerCount = 10
  const layerSize = Math.ceil(maxDegree / layerCount)
  const layers: string[][] = Array.from({ length: layerCount }, () => [])
  
  degreeGroups.forEach((groupNodes, degree) => {
    const layerIdx = Math.min(layerCount - 1, Math.floor(degree / layerSize))
    layers[layerIdx].push(...groupNodes)
  })

  layers.reverse()

  let currentRadius = BASE_SPACING * 2

  layers.forEach((layerNodes, layerIdx) => {
    if (layerNodes.length === 0) return

    // 计算该层所需半径：周长 = 节点数 * 间距
    const requiredRadius = Math.max(currentRadius, (layerNodes.length * BASE_SPACING) / (2 * Math.PI))
    const angleStep = (2 * Math.PI) / layerNodes.length

    layerNodes.forEach((node, i) => {
      const angle = i * angleStep + layerIdx * 0.15
      g.setNodeAttribute(node, 'x', requiredRadius * Math.cos(angle))
      g.setNodeAttribute(node, 'y', requiredRadius * Math.sin(angle))
    })

    currentRadius = requiredRadius + BASE_SPACING * 1.2
  })
}

// ============ 布局切换 ============

async function switchLayout(layoutId: LayoutId): Promise<void> {
  if (!graph || layoutState.value === 'running') return

  currentLayout.value = layoutId
  layoutState.value = 'running'
  const startTime = performance.now()

  try {
    // 停止之前的 FA2
    if (fa2Layout?.isRunning()) {
      fa2Layout.stop()
    }

    await nextTick()

    switch (layoutId) {
      case 'organic':
        await applyOrganicLayout(graph)
        break
      case 'grid-cluster':
        applyGridClusterLayout(graph)
        break
      case 'radial-tree':
        applyRadialTreeLayout(graph)
        break
      case 'force-cluster':
        await applyForceClusterLayout(graph)
        break
      case 'concentric-rings':
        applyConcentricRingsLayout(graph)
        break
    }

    // 非力导向布局不需要 noverlap，布局算法本身已保证间距
    sigma?.refresh()
    layoutTime.value = Math.round(performance.now() - startTime)
    layoutState.value = 'done'
  } catch (err) {
    console.error('[SigmaLayoutTest] Layout error:', err)
    layoutState.value = 'error'
  }
}

// ============ Sigma 渲染器 ============

function createSigmaRenderer(g: Graph): Sigma | null {
  if (!containerRef.value) return null

  // 使用 node-border 程序：白色边框 + 从 color 属性读取填充色
  const NodeBorderProgram = createNodeBorderProgram({
    borders: [
      { size: { value: 0.12 }, color: { value: '#ffffff' } },  // 外层白色边框
      { size: { fill: true }, color: { attribute: 'color' } }  // 内层填充，从节点 color 属性读取
    ]
  })

  const s = new Sigma(g, containerRef.value, {
    renderLabels: false,  // 禁用标签提升性能
    labelRenderedSizeThreshold: 100,
    defaultNodeColor: '#94a3b8',
    defaultEdgeColor: '#e2e8f0',
    defaultEdgeType: 'curvedArrow',
    minCameraRatio: 0.01,
    maxCameraRatio: 10,
    zIndex: true,
    enableEdgeEvents: false,
    defaultNodeType: 'border',
    nodeProgramClasses: {
      border: NodeBorderProgram
    },
    edgeProgramClasses: {
      curvedArrow: EdgeCurvedArrowProgram
    }
  })

  return s
}

// ============ 操作方法 ============

function regenerateGraph(): void {
  if (layoutState.value === 'running') return

  // 清理
  if (fa2Layout) {
    fa2Layout.kill()
    fa2Layout = null
  }
  if (sigma) {
    sigma.kill()
    sigma = null
  }

  // 重新生成
  graph = generateTestGraph()
  sigma = createSigmaRenderer(graph)

  // 应用当前布局
  switchLayout(currentLayout.value)
}

function resetCamera(): void {
  sigma?.getCamera().animatedReset({ duration: 300 })
}

// ============ 生命周期 ============

onMounted(() => {
  nextTick(() => {
    graph = generateTestGraph()
    sigma = createSigmaRenderer(graph)
    switchLayout(currentLayout.value)
  })
})

onBeforeUnmount(() => {
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
</script>

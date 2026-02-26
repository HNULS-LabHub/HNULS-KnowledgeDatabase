<template>
  <div class="kgs-graph-canvas flex-1 flex flex-col min-h-0">
    <!-- 顶部信息栏 -->
    <div class="flex items-center gap-2 px-3 py-2 flex-shrink-0 border-b border-slate-100 bg-white">
      <span class="text-xs font-medium text-slate-600">图谱关系</span>
      <span v-if="nodeCount > 0" class="text-[10px] text-slate-400">
        {{ nodeCount }} 实体 · {{ edgeCount }} 关系
      </span>
      <div class="ml-auto flex items-center gap-1.5">
        <!-- 图例 -->
        <span
          v-for="item in legend"
          :key="item.type"
          class="flex items-center gap-1 text-[10px] text-slate-500"
        >
          <span class="w-2 h-2 rounded-full flex-shrink-0" :style="{ background: item.color }" />
          {{ item.type }}
        </span>
      </div>
    </div>

    <!-- Cytoscape 容器 -->
    <div ref="containerRef" class="flex-1 min-h-0 relative bg-slate-50 overflow-hidden">
      <!-- 空状态 -->
      <div
        v-if="nodeCount === 0"
        class="absolute inset-0 flex items-center justify-center text-xs text-slate-400"
      >
        暂无实体数据
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import cytoscape from 'cytoscape'
import type { Core, ElementDefinition } from 'cytoscape'
import { useKGSearchStore } from '@renderer/stores/kg-search/kg-search.store'
import { buildColorMap, getTypeColor } from '../../GraphView/color-palette'

const kgStore = useKGSearchStore()

// ─── 状态 ────────────────────────────────────────────────────────────────────
const containerRef = ref<HTMLElement | null>(null)
let cy: Core | null = null
let colorMap = new Map<string, string>()

// ─── 衍生数据 ─────────────────────────────────────────────────────────────────
const nodeCount = computed(() => kgStore.result?.entities.length ?? 0)
const edgeCount = computed(() => kgStore.result?.relations.length ?? 0)

const legend = computed(() => {
  const types = new Set(kgStore.result?.entities.map((e) => e.entity_type) ?? [])
  const cm = buildColorMap([...types])
  return [...types].map((t) => ({ type: t, color: cm.get(t) ?? '#94a3b8' }))
})

// ─── Cytoscape 样式配置 ───────────────────────────────────────────────────────

const styleConfig = [
  // 查询中心节点（圆形，显示Start）
  {
    selector: 'node[nodeType="query"]',
    style: {
      width: 0,
      height: 0,
      'background-color': '#0f766e',
      'border-width': 2,
      'border-color': '#ffffff',
      'outline-width': 10,
      'outline-color': '#0f766e',
      'outline-opacity': 0.3,
      'outline-offset': 3,
      label: 'data(label)',
      'text-valign': 'center',
      'text-halign': 'center',
      'font-size': '12px',
      color: '#ffffff',
      'font-weight': 'bold',
      'z-index': 10
    }
  },
  // 实体节点
  {
    selector: 'node[nodeType="entity"]',
    style: {
      width: 0,
      height: 0,
      'background-color': 'data(color)',
      'border-width': 2,
      'border-color': '#ffffff',
      'outline-width': 6,
      'outline-color': 'data(color)',
      'outline-opacity': 0.4,
      'outline-offset': 2,
      label: 'data(label)',
      'font-size': '10px',
      color: '#334155',
      'text-background-opacity': 0.8,
      'text-background-color': '#ffffff',
      'text-background-padding': '2px'
    }
  },
  // 关系边
  {
    selector: 'edge',
    style: {
      width: 0,
      'line-color': '#cbd5e1',
      'curve-style': 'unbundled-bezier',
      'control-point-distances': 'data(controlDistance)', // 使用数据中的控制点距离
      'control-point-weights': 0.5, // 控制点在边中点
      'target-arrow-shape': 'triangle',
      'target-arrow-color': '#cbd5e1',
      'arrow-scale': 0.8,
      label: 'data(keywords)',
      'font-size': '9px',
      color: '#64748b',
      'text-background-opacity': 0.9,
      'text-background-color': '#f8fafc',
      'text-background-padding': '2px',
      'text-rotation': 'autorotate',
      'text-margin-y': -8
    }
  },
  // 查询节点到实体的连线（蓝色实线）
  {
    selector: 'edge[edgeType="query-to-entity"]',
    style: {
      'line-color': '#3b82f6',
      'target-arrow-color': '#3b82f6',
      'line-style': 'solid'
    }
  }
]

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── 图构建 ───────────────────────────────────────────────────────────────────

function buildGraphData(): { nodes: ElementDefinition[]; edges: ElementDefinition[] } {
  const result = kgStore.result
  if (!result || result.entities.length === 0) return { nodes: [], edges: [] }

  const nodes: ElementDefinition[] = []
  const edges: ElementDefinition[] = []

  // 收集实体类型，构建颜色映射
  const types = [...new Set(result.entities.map((e) => e.entity_type))]
  colorMap = buildColorMap(types)

  // 1. 中心查询节点（圆形，显示Start）
  nodes.push({
    data: {
      id: '__query__',
      label: 'Start',
      nodeType: 'query',
      color: '#0f766e',
      targetSize: 28,
      level: 0
    },
    position: { x: 0, y: 0 }
  })

  // 2. 实体节点（径向分布）
  const entityCount = result.entities.length
  const INNER_MAX = Math.min(entityCount, 18)
  const innerRadius = 200
  const outerRadius = 350

  result.entities.forEach((entity, i) => {
    const isInner = i < INNER_MAX
    const groupIdx = isInner ? i : i - INNER_MAX
    const groupSize = isInner ? INNER_MAX : entityCount - INNER_MAX
    const baseRadius = isInner ? innerRadius : outerRadius
    const angle = (groupIdx / groupSize) * 2 * Math.PI - Math.PI / 2

    // 添加大幅度径向噪声（±30%）和角度扰动（±15度）
    const radiusNoise = baseRadius * (0.7 + Math.random() * 0.6)
    const angleNoise = angle + (Math.random() - 0.5) * (Math.PI / 6)

    const targetSize = 6 + Math.min(entity.score * 8, 8)

    nodes.push({
      data: {
        id: entity.id,
        label: entity.name,
        nodeType: 'entity',
        entityType: entity.entity_type,
        color: getTypeColor(colorMap, entity.entity_type),
        score: entity.score,
        targetSize,
        isInner,
        level: 1 // 一级节点
      },
      position: {
        x: radiusNoise * Math.cos(angleNoise),
        y: radiusNoise * Math.sin(angleNoise)
      }
    })

    // 查询节点到实体的连线（score > 0.3）
    if (entity.score > 0.3) {
      edges.push({
        data: {
          id: `__query__--${entity.id}`,
          source: '__query__',
          target: entity.id,
          edgeType: 'query-to-entity',
          keywords: '',
          targetWidth: 1.5,
          controlDistance: (Math.random() - 0.5) * 60 // 随机曲率 -30~30
        }
      })
    }
  })

  // 3. 关系边
  const nameToId = new Map(result.entities.map((e) => [e.name, e.id]))
  result.relations.forEach((rel, idx) => {
    const srcId = nameToId.get(rel.source_name)
    const tgtId = nameToId.get(rel.target_name)
    if (srcId && tgtId && srcId !== tgtId) {
      edges.push({
        data: {
          id: `rel-${idx}`,
          source: srcId,
          target: tgtId,
          keywords: rel.keywords || '',
          edgeType: 'relation',
          targetWidth: 2,
          controlDistance: (Math.random() - 0.5) * 80 // 关系边曲率更大 -40~40
        }
      })
    }
  })

  return { nodes, edges }
}

async function buildAndAnimate(): Promise<void> {
  const { nodes, edges } = buildGraphData()
  if (nodes.length === 0) return

  // 清空现有图谱
  if (cy) {
    cy.elements().remove()
  }

  // 1. 先添加所有节点（大小为0，不可见）
  const addedNodes = cy!.add(nodes)

  // 2. 添加所有边（宽度为0，不可见）
  const addedEdges = cy!.add(edges)

  // 3. 温和的防重叠：多次迭代，每次小幅度调整
  const entityNodes = addedNodes.filter('[nodeType="entity"]')
  const minDistance = 35 // 最小节点间距
  const iterations = 3 // 迭代次数

  for (let iter = 0; iter < iterations; iter++) {
    entityNodes.forEach((node) => {
      const pos = node.position()
      let dx = 0
      let dy = 0
      let count = 0

      // 计算与所有其他节点的排斥力
      entityNodes.forEach((otherNode) => {
        if (node === otherNode) return
        const otherPos = otherNode.position()
        const deltaX = pos.x - otherPos.x
        const deltaY = pos.y - otherPos.y
        const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

        // 如果距离太近，累加排斥力
        if (dist > 0 && dist < minDistance) {
          const force = (minDistance - dist) / minDistance
          dx += (deltaX / dist) * force
          dy += (deltaY / dist) * force
          count++
        }
      })

      // 应用小幅度调整
      if (count > 0) {
        pos.x += dx * 3 // 调整幅度
        pos.y += dy * 3
        node.position(pos)
      }
    })
  }

  // 3. 中心节点立即弹出
  const centerNode = addedNodes.filter('[nodeType="query"]')
  const centerData = nodes[0].data
  centerNode.animate({
    style: { width: centerData.targetSize || 28, height: centerData.targetSize || 28 },
    duration: 600,
    easing: 'spring(250, 15)'
  })

  await sleep(400)

  // 4. 分离一级边和一级节点
  const level1Edges = edges.filter((e) => e.data.edgeType === 'query-to-entity')
  const level1Nodes = nodes.filter((n) => n.data.level === 1)
  const relationEdges = edges.filter((e) => e.data.edgeType === 'relation')

  console.log('[KGGraphCanvas] Animation start:', {
    level1Edges: level1Edges.length,
    level1Nodes: level1Nodes.length,
    relationEdges: relationEdges.length
  })

  // 5. 逐条播放：边生长 → 节点弹出
  for (let i = 0; i < level1Edges.length; i++) {
    const edgeData = level1Edges[i]
    const targetNodeData = level1Nodes.find((n) => n.data.id === edgeData.data.target)
    if (!targetNodeData) {
      console.warn('[KGGraphCanvas] Target node not found for edge:', edgeData.data.id)
      continue
    }

    setTimeout(() => {
      // 5.1 边开始生长
      const edge = cy!.getElementById(edgeData.data.id)
      if (edge.length === 0) {
        console.error('[KGGraphCanvas] Edge not found:', edgeData.data.id)
        return
      }
      edge.animate({
        style: { width: edgeData.data.targetWidth || 1.5 },
        duration: 500,
        easing: 'ease-out'
      })

      // 5.2 边生长到一半时，目标节点开始弹出
      setTimeout(() => {
        const node = cy!.getElementById(targetNodeData.data.id)
        if (node.length === 0) {
          console.error('[KGGraphCanvas] Node not found:', targetNodeData.data.id)
          return
        }
        node.animate({
          style: { width: targetNodeData.data.targetSize, height: targetNodeData.data.targetSize },
          duration: 600,
          easing: 'spring(200, 12)'
        })
      }, 250)
    }, i * 120) // 每条边间隔120ms
  }

  // 等待所有一级节点出现完毕
  await sleep(level1Edges.length * 120 + 800)

  // 6. 逐条添加关系边（二级连接）
  for (let i = 0; i < relationEdges.length; i++) {
    setTimeout(() => {
      const edge = cy!.getElementById(relationEdges[i].data.id)
      if (edge.length > 0) {
        edge.animate({
          style: { width: relationEdges[i].data.targetWidth || 2 },
          duration: 400,
          easing: 'ease-out'
        })
      }
    }, i * 80)
  }
}

// ─── Cytoscape 初始化 ─────────────────────────────────────────────────────────

function initCytoscape(): void {
  if (!containerRef.value) return

  cy = cytoscape({
    container: containerRef.value,
    style: styleConfig,
    layout: { name: 'preset' },
    minZoom: 0.1,
    maxZoom: 3,
    wheelSensitivity: 0.5 // 提高滚轮灵敏度（原0.2 → 0.5）
  })
}

function destroyCytoscape(): void {
  if (cy) {
    cy.destroy()
    cy = null
  }
}

// ─── 生命周期 ──────────────────────────────────────────────────────────────────

onMounted(() => {
  initCytoscape()
  if (kgStore.hasResult) {
    nextTick(() => buildAndAnimate())
  }
})

onBeforeUnmount(() => {
  destroyCytoscape()
})

watch(
  () => kgStore.result,
  (val) => {
    if (val) {
      nextTick(() => buildAndAnimate())
    } else if (cy) {
      cy.elements().remove()
    }
  }
)
</script>

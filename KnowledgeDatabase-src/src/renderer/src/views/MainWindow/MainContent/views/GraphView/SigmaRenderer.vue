<template>
  <div ref="containerRef" class="gv-sigma-renderer w-full h-full bg-slate-50" />
</template>

<script setup lang="ts">
/**
 * Sigma.js 渲染器封装
 *
 * 职责：
 * 1. 接收 entities + relations → 构建 graphology Graph
 * 2. 计算布局（ForceAtlas2）
 * 3. 渲染（Sigma + 贝塞尔曲线边）
 * 4. 处理交互事件（hover / click）
 *
 * 当前阶段：使用 Canvas 2D 模拟渲染（sigma 依赖未安装）
 * 后续：安装 sigma + graphology 后替换为真实 WebGL 渲染
 */

import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
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

// ============ 内部状态 ============
interface NodePos {
  x: number
  y: number
  size: number
  color: string
  label: string
  type: string
  degree: number
}

let nodes = new Map<string, NodePos>()
let edges: Array<{ source: string; target: string; weight: number }> = []
let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null

// 相机状态
let camera = { x: 0, y: 0, zoom: 1 }
let isDragging = false
let dragStart = { x: 0, y: 0 }
let cameraStart = { x: 0, y: 0 }

// ============ 布局计算（简化版力导向） ============

function computeLayout(
  entityList: GraphEntity[],
  relationList: GraphRelation[]
): Map<string, NodePos> {
  const map = new Map<string, NodePos>()
  const cm = buildColorMap(props.entityTypes)
  emit('color-map-ready', cm)

  // 计算 degree
  const degreeMap = new Map<string, number>()
  for (const r of relationList) {
    degreeMap.set(r.source, (degreeMap.get(r.source) ?? 0) + 1)
    degreeMap.set(r.target, (degreeMap.get(r.target) ?? 0) + 1)
  }

  const maxDegree = Math.max(1, ...Array.from(degreeMap.values()))

  // 初始位置：圆形布局
  const n = entityList.length
  for (let i = 0; i < n; i++) {
    const e = entityList[i]
    const angle = (2 * Math.PI * i) / n
    const radius = 300
    const degree = degreeMap.get(e.id) ?? 0
    const size = 4 + (degree / maxDegree) * 20

    map.set(e.id, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      size,
      color: getTypeColor(cm, e.type),
      label: e.name,
      type: e.type,
      degree
    })
  }

  // 简化版力导向迭代
  const positions = Array.from(map.entries())
  const idIndex = new Map(positions.map(([id], i) => [id, i]))

  for (let iter = 0; iter < 300; iter++) {
    const forces = positions.map(() => ({ fx: 0, fy: 0 }))

    // 斥力
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const [, a] = positions[i]
        const [, b] = positions[j]
        let dx = a.x - b.x
        let dy = a.y - b.y
        let dist = Math.sqrt(dx * dx + dy * dy) || 1
        const repulsion = 8000 / (dist * dist)
        const fx = (dx / dist) * repulsion
        const fy = (dy / dist) * repulsion
        forces[i].fx += fx
        forces[i].fy += fy
        forces[j].fx -= fx
        forces[j].fy -= fy
      }
    }

    // 引力（边）
    for (const r of relationList) {
      const si = idIndex.get(r.source)
      const ti = idIndex.get(r.target)
      if (si === undefined || ti === undefined) continue
      const [, a] = positions[si]
      const [, b] = positions[ti]
      let dx = b.x - a.x
      let dy = b.y - a.y
      let dist = Math.sqrt(dx * dx + dy * dy) || 1
      const attraction = dist * 0.01
      const fx = (dx / dist) * attraction
      const fy = (dy / dist) * attraction
      forces[si].fx += fx
      forces[si].fy += fy
      forces[ti].fx -= fx
      forces[ti].fy -= fy
    }

    // 重力
    for (let i = 0; i < positions.length; i++) {
      const [, node] = positions[i]
      const dist = Math.sqrt(node.x * node.x + node.y * node.y) || 1
      forces[i].fx -= (node.x / dist) * 0.5
      forces[i].fy -= (node.y / dist) * 0.5
    }

    // 应用力
    const cooling = 1 - iter / 300
    for (let i = 0; i < positions.length; i++) {
      const [, node] = positions[i]
      const maxForce = 10 * cooling
      let fx = Math.max(-maxForce, Math.min(maxForce, forces[i].fx))
      let fy = Math.max(-maxForce, Math.min(maxForce, forces[i].fy))
      node.x += fx
      node.y += fy
    }
  }

  // 写回 map
  for (const [id, node] of positions) {
    map.set(id, node)
  }

  return map
}

// ============ Canvas 渲染 ============

function render(): void {
  if (!ctx || !canvas) {
    console.log('[GraphView] render() skipped: ctx or canvas is null')
    return
  }

  console.log('[GraphView] render() called, nodes:', nodes.size, 'canvas:', canvas.width, 'x', canvas.height)

  const w = canvas.width
  const h = canvas.height
  const dpr = window.devicePixelRatio || 1

  ctx.clearRect(0, 0, w, h)
  ctx.save()

  // 应用相机变换
  ctx.translate(w / 2 + camera.x * dpr, h / 2 + camera.y * dpr)
  ctx.scale(camera.zoom * dpr, camera.zoom * dpr)

  const activeNode = props.selectedNodeId ?? props.hoveredNodeId
  const activeNeighbors = new Set<string>()
  if (activeNode) {
    for (const e of edges) {
      if (e.source === activeNode) activeNeighbors.add(e.target)
      if (e.target === activeNode) activeNeighbors.add(e.source)
    }
  }

  // 绘制边（贝塞尔曲线）
  for (const edge of edges) {
    const src = nodes.get(edge.source)
    const tgt = nodes.get(edge.target)
    if (!src || !tgt) continue

    const isActive = activeNode && (edge.source === activeNode || edge.target === activeNode)
    const isHidden = activeNode && !isActive

    ctx.beginPath()
    ctx.strokeStyle = isHidden ? 'rgba(200,200,200,0.15)' : isActive ? 'rgba(91,143,249,0.6)' : 'rgba(180,180,180,0.35)'
    ctx.lineWidth = isActive ? 1.5 : 0.8

    // 贝塞尔曲线：控制点偏移
    const mx = (src.x + tgt.x) / 2
    const my = (src.y + tgt.y) / 2
    const dx = tgt.x - src.x
    const dy = tgt.y - src.y
    const offset = Math.sqrt(dx * dx + dy * dy) * 0.15
    const cx = mx - dy * offset / Math.sqrt(dx * dx + dy * dy + 1)
    const cy = my + dx * offset / Math.sqrt(dx * dx + dy * dy + 1)

    ctx.moveTo(src.x, src.y)
    ctx.quadraticCurveTo(cx, cy, tgt.x, tgt.y)
    ctx.stroke()
  }

  // 绘制节点
  for (const [id, node] of nodes) {
    const isSelected = id === props.selectedNodeId
    const isHovered = id === props.hoveredNodeId
    const isNeighbor = activeNeighbors.has(id)
    const isActiveNode = id === activeNode
    const isHidden = activeNode && !isActiveNode && !isNeighbor

    ctx.beginPath()
    const radius = isSelected ? node.size * 1.3 : isHovered ? node.size * 1.15 : node.size

    if (isHidden) {
      ctx.fillStyle = 'rgba(220,220,220,0.5)'
    } else {
      ctx.fillStyle = node.color
    }

    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2)
    ctx.fill()

    // 选中/悬停边框
    if (isSelected || isHovered) {
      ctx.strokeStyle = isSelected ? '#1e40af' : '#3b82f6'
      ctx.lineWidth = isSelected ? 2.5 : 1.5
      ctx.stroke()
    }

    // 标签
    if (!isHidden && (camera.zoom > 0.6 || node.size > 8 || isActiveNode || isNeighbor)) {
      ctx.fillStyle = isHidden ? 'transparent' : 'rgba(30,41,59,0.85)'
      ctx.font = `${isActiveNode ? 'bold ' : ''}${Math.max(10, 11 / camera.zoom)}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(node.label, node.x, node.y + radius + 3)
    }
  }

  ctx.restore()
}

// ============ 交互 ============

function screenToWorld(sx: number, sy: number): { wx: number; wy: number } {
  if (!canvas) return { wx: 0, wy: 0 }
  const rect = canvas.getBoundingClientRect()
  const cx = (sx - rect.left - rect.width / 2 - camera.x) / camera.zoom
  const cy = (sy - rect.top - rect.height / 2 - camera.y) / camera.zoom
  return { wx: cx, wy: cy }
}

function findNodeAt(wx: number, wy: number): string | null {
  let closest: string | null = null
  let minDist = Infinity
  for (const [id, node] of nodes) {
    const dx = wx - node.x
    const dy = wy - node.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const hitRadius = node.size * 1.5
    if (dist < hitRadius && dist < minDist) {
      minDist = dist
      closest = id
    }
  }
  return closest
}

function handleMouseDown(e: MouseEvent): void {
  isDragging = true
  dragStart = { x: e.clientX, y: e.clientY }
  cameraStart = { ...camera }
}

function handleMouseMove(e: MouseEvent): void {
  if (isDragging) {
    camera.x = cameraStart.x + (e.clientX - dragStart.x)
    camera.y = cameraStart.y + (e.clientY - dragStart.y)
    render()
    return
  }

  const { wx, wy } = screenToWorld(e.clientX, e.clientY)
  const nodeId = findNodeAt(wx, wy)
  if (nodeId !== props.hoveredNodeId) {
    emit('hover-node', nodeId)
  }
}

function handleMouseUp(e: MouseEvent): void {
  const wasDrag = Math.abs(e.clientX - dragStart.x) > 3 || Math.abs(e.clientY - dragStart.y) > 3
  isDragging = false

  if (!wasDrag) {
    const { wx, wy } = screenToWorld(e.clientX, e.clientY)
    const nodeId = findNodeAt(wx, wy)
    emit('select-node', nodeId)
  }
}

function handleWheel(e: WheelEvent): void {
  e.preventDefault()
  const factor = e.deltaY > 0 ? 0.9 : 1.1
  camera.zoom = Math.max(0.1, Math.min(5, camera.zoom * factor))
  render()
}

// ============ 生命周期 ============

function setupCanvas(): void {
  if (!containerRef.value) {
    console.log('[GraphView] setupCanvas() skipped: containerRef is null')
    return
  }

  console.log('[GraphView] setupCanvas() called')
  canvas = document.createElement('canvas')
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.cursor = 'grab'
  containerRef.value.appendChild(canvas)

  ctx = canvas.getContext('2d')
  console.log('[GraphView] Canvas created, ctx:', !!ctx)
  resizeCanvas()

  canvas.addEventListener('mousedown', handleMouseDown)
  canvas.addEventListener('mousemove', handleMouseMove)
  canvas.addEventListener('mouseup', handleMouseUp)
  canvas.addEventListener('mouseleave', () => {
    isDragging = false
    emit('hover-node', null)
  })
  canvas.addEventListener('wheel', handleWheel, { passive: false })
}

function resizeCanvas(): void {
  if (!canvas || !containerRef.value) {
    console.log('[GraphView] resizeCanvas() skipped')
    return
  }
  const dpr = window.devicePixelRatio || 1
  const rect = containerRef.value.getBoundingClientRect()
  console.log('[GraphView] resizeCanvas() rect:', rect.width, 'x', rect.height)
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`
  render()
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  console.log('[GraphView] SigmaRenderer mounted, entities:', props.entities.length)
  setupCanvas()
  resizeObserver = new ResizeObserver(() => resizeCanvas())
  if (containerRef.value) resizeObserver.observe(containerRef.value)

  // 如果挂载时已有数据，立即计算布局
  if (props.entities.length > 0) {
    console.log('[GraphView] Computing layout on mount...')
    nodes = computeLayout(props.entities, props.relations)
    edges = props.relations.map(r => ({ source: r.source, target: r.target, weight: r.weight }))
    console.log('[GraphView] Layout computed, nodes:', nodes.size, 'edges:', edges.length)
    nextTick(() => {
      console.log('[GraphView] Rendering after nextTick...')
      render()
    })
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  if (canvas) {
    canvas.removeEventListener('mousedown', handleMouseDown)
    canvas.removeEventListener('mousemove', handleMouseMove)
    canvas.removeEventListener('mouseup', handleMouseUp)
    canvas.removeEventListener('wheel', handleWheel)
  }
})

// 数据变化时重新计算布局
watch(
  () => [props.entities, props.relations, props.entityTypes] as const,
  ([ents, rels]) => {
    if (ents.length === 0) return
    nodes = computeLayout(ents, rels)
    edges = rels.map(r => ({ source: r.source, target: r.target, weight: r.weight }))
    camera = { x: 0, y: 0, zoom: 1 }
    nextTick(() => render())
  },
  { deep: true }
)

// 选中/悬停变化时重绘
watch(
  () => [props.selectedNodeId, props.hoveredNodeId],
  () => render()
)
</script>

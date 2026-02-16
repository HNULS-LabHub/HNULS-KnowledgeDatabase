<template>
  <div class="gv-root flex flex-col h-full bg-slate-50">
    <!-- 页面头部 -->
    <header class="gv-header flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="5" r="2" />
            <circle cx="5" cy="19" r="2" />
            <circle cx="19" cy="19" r="2" />
            <line x1="12" y1="7" x2="5" y2="17" />
            <line x1="12" y1="7" x2="19" y2="17" />
            <line x1="5" y1="19" x2="19" y2="19" />
          </svg>
          <h1 class="text-base font-semibold text-slate-800 m-0">Graph RAG 知识图谱</h1>
        </div>
      </div>
      <GraphSelector
        v-model="store.selectedGraphOption"
        :options="store.graphOptions"
        @update:model-value="handleGraphSelect"
      />
    </header>

    <!-- 主内容区 -->
    <main class="gv-main flex-1 relative overflow-hidden bg-white">
      <!-- 空闲状态：未选择图谱 -->
      <div
        v-if="store.loadState === 'idle'"
        class="gv-idle absolute inset-0 flex flex-col items-center justify-center text-center px-6"
      >
        <div class="w-20 h-20 mb-6 rounded-2xl bg-slate-100 flex items-center justify-center">
          <svg class="w-10 h-10 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="5" r="2" />
            <circle cx="5" cy="19" r="2" />
            <circle cx="19" cy="19" r="2" />
            <line x1="12" y1="7" x2="5" y2="17" opacity="0.5" />
            <line x1="12" y1="7" x2="19" y2="17" opacity="0.5" />
            <line x1="5" y1="19" x2="19" y2="19" opacity="0.5" />
          </svg>
        </div>
        <h2 class="text-lg font-medium text-slate-600 mb-2 m-0">选择一个知识图谱</h2>
        <p class="text-sm text-slate-400 max-w-sm m-0">
          从右上角的下拉菜单中选择一个已构建的知识图谱，即可查看实体和关系的可视化展示
        </p>
      </div>

      <!-- 加载中 -->
      <LoadingOverlay
        v-if="store.loadState === 'loading'"
        :progress="store.progress"
        :percent="store.progressPercent"
      />

      <!-- 错误状态 -->
      <div
        v-if="store.loadState === 'error'"
        class="gv-error absolute inset-0 flex flex-col items-center justify-center text-center px-6"
      >
        <div class="w-16 h-16 mb-4 rounded-full bg-red-50 flex items-center justify-center">
          <svg class="w-8 h-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 class="text-base font-medium text-slate-700 mb-1 m-0">加载失败</h3>
        <p class="text-sm text-slate-400 mb-4 m-0">{{ store.errorMessage }}</p>
        <button
          class="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors cursor-pointer border-none"
          @click="handleRetry"
        >
          重试
        </button>
      </div>

      <!-- 图谱渲染区 -->
      <template v-if="store.loadState === 'ready'">
        <SigmaRenderer
          :entities="store.entities"
          :relations="store.relations"
          :entity-types="store.entityTypes"
          :selected-node-id="store.selectedNodeId"
          :selected-edge-id="store.selectedEdgeId"
          :hovered-node-id="store.hoveredNodeId"
          @select-node="store.selectNode"
          @select-edge="store.selectEdge"
          @hover-node="store.hoverNode"
          @color-map-ready="handleColorMapReady"
        />

        <!-- 图例 -->
        <GraphLegend :legend="legendItems" />

        <!-- 详情抽屉 -->
        <DetailDrawer
          :node-detail="store.selectedNodeDetail"
          :edge-detail="store.selectedEdgeDetail"
          :edges="store.selectedNodeEdges"
          :color-map="colorMap"
          :entities="store.entities"
          @close="handleDrawerClose"
          @back-to-node="store.selectEdge(null)"
          @select-edge="store.selectEdge"
        />
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useGraphViewerStore } from './graph-viewer.store'
import type { GraphOption } from './types'
import { colorMapToLegend } from './color-palette'

import GraphSelector from './GraphSelector.vue'
import LoadingOverlay from './LoadingOverlay.vue'
import SigmaRenderer from './SigmaRenderer.vue'
import GraphLegend from './GraphLegend.vue'
import DetailDrawer from './DetailDrawer.vue'

const store = useGraphViewerStore()
const colorMap = ref<Map<string, string>>(new Map())

const legendItems = computed(() => colorMapToLegend(colorMap.value))

onMounted(() => {
  store.loadAllConfigs()
})

function handleGraphSelect(option: GraphOption | null): void {
  if (option) {
    store.loadGraph(option)
  } else {
    store.reset()
  }
}

function handleColorMapReady(cm: Map<string, string>): void {
  colorMap.value = cm
}

function handleRetry(): void {
  if (store.selectedGraphOption) {
    store.loadGraph(store.selectedGraphOption)
  }
}

function handleDrawerClose(): void {
  store.selectNode(null)
  store.selectEdge(null)
}
</script>

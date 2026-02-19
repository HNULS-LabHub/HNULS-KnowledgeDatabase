<template>
  <transition name="drawer">
    <div
      v-if="isOpen"
      class="gv-detail-drawer absolute top-0 right-0 z-20 h-full w-80 bg-white/98 backdrop-blur-sm border-l border-slate-200 shadow-xl flex flex-col"
    >
      <!-- 头部 -->
      <div class="flex items-center gap-3 px-4 py-3 border-b border-slate-100 flex-shrink-0">
        <!-- 返回按钮（边详情时显示） -->
        <button
          v-if="mode === 'edge'"
          class="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer border-none bg-transparent"
          title="返回节点详情"
          @click="$emit('back-to-node')"
        >
          <svg
            class="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <!-- 标题 -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span
              v-if="mode === 'node' && nodeDetail"
              class="w-3 h-3 rounded-full flex-shrink-0"
              :style="{ backgroundColor: nodeTypeColor }"
            />
            <svg
              v-else-if="mode === 'edge'"
              class="w-4 h-4 text-slate-400 flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
            <h4 class="text-sm font-semibold text-slate-800 truncate m-0">
              {{ title }}
            </h4>
          </div>
          <p v-if="subtitle" class="text-xs text-slate-400 truncate mt-0.5 m-0">{{ subtitle }}</p>
        </div>

        <!-- 关闭按钮 -->
        <button
          class="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer border-none bg-transparent"
          @click="$emit('close')"
        >
          <svg
            class="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <!-- 内容区 -->
      <div class="flex-1 overflow-y-auto">
        <!-- 节点详情 -->
        <template v-if="mode === 'node' && nodeDetail">
          <!-- 基本信息 -->
          <section class="px-4 py-3 border-b border-slate-50">
            <div class="flex items-center gap-4 text-xs">
              <div class="flex items-center gap-1.5">
                <span class="text-slate-400">类型</span>
                <span
                  class="px-2 py-0.5 rounded-full font-medium"
                  :style="{ backgroundColor: nodeTypeColor + '18', color: nodeTypeColor }"
                >
                  {{ nodeDetail.type }}
                </span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-slate-400">连接</span>
                <span class="font-medium text-slate-700">{{ nodeDetail.degree }}</span>
              </div>
            </div>
          </section>

          <!-- 描述 -->
          <section v-if="nodeDetail.description" class="px-4 py-3 border-b border-slate-50">
            <h5 class="text-xs font-medium text-slate-500 mb-2 m-0">描述</h5>
            <p class="text-sm text-slate-600 leading-relaxed m-0">{{ nodeDetail.description }}</p>
          </section>

          <!-- 关联边列表 -->
          <section v-if="edges.length > 0" class="px-4 py-3">
            <h5 class="text-xs font-medium text-slate-500 mb-2 m-0">
              关联关系 ({{ edges.length }})
            </h5>
            <div class="space-y-1.5">
              <button
                v-for="edge in edges"
                :key="edge.id"
                class="w-full text-left px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer border-none"
                @click="$emit('select-edge', edge.id)"
              >
                <div class="flex items-center gap-2 text-xs">
                  <span class="text-slate-500 truncate max-w-[80px]">
                    {{ getEdgeSourceName(edge) }}
                  </span>
                  <svg
                    class="w-3 h-3 text-slate-300 flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                  <span class="text-slate-500 truncate max-w-[80px]">
                    {{ getEdgeTargetName(edge) }}
                  </span>
                </div>
                <div v-if="edge.keywords" class="text-xs text-blue-500 mt-1 truncate">
                  {{ edge.keywords }}
                </div>
              </button>
            </div>
          </section>
        </template>

        <!-- 边详情 -->
        <template v-else-if="mode === 'edge' && edgeDetail">
          <!-- 连接信息 -->
          <section class="px-4 py-3 border-b border-slate-50">
            <div class="flex items-center gap-2 text-sm">
              <span class="text-slate-700 font-medium truncate max-w-[100px]">{{
                edgeDetail.sourceName
              }}</span>
              <svg
                class="w-4 h-4 text-slate-300 flex-shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
              <span class="text-slate-700 font-medium truncate max-w-[100px]">{{
                edgeDetail.targetName
              }}</span>
            </div>
            <div v-if="edgeDetail.weight" class="text-xs text-slate-400 mt-1">
              权重: {{ edgeDetail.weight.toFixed(2) }}
            </div>
          </section>

          <!-- 关键词 -->
          <section v-if="edgeDetail.keywords" class="px-4 py-3 border-b border-slate-50">
            <h5 class="text-xs font-medium text-slate-500 mb-2 m-0">关键词</h5>
            <p class="text-sm text-blue-600 m-0">{{ edgeDetail.keywords }}</p>
          </section>

          <!-- 描述 -->
          <section v-if="edgeDetail.description" class="px-4 py-3">
            <h5 class="text-xs font-medium text-slate-500 mb-2 m-0">描述</h5>
            <p class="text-sm text-slate-600 leading-relaxed m-0">{{ edgeDetail.description }}</p>
          </section>
        </template>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { NodeDetail, GraphRelation } from './types'
import type { EdgeDetail } from './graph-viewer.store'

const props = defineProps<{
  nodeDetail: NodeDetail | null
  edgeDetail: EdgeDetail | null
  edges: GraphRelation[]
  colorMap: Map<string, string>
  entities: Array<{ id: string; name: string }>
}>()

defineEmits<{
  close: []
  'back-to-node': []
  'select-edge': [edgeId: string]
}>()

const isOpen = computed(() => props.nodeDetail !== null || props.edgeDetail !== null)

const mode = computed<'node' | 'edge' | null>(() => {
  if (props.edgeDetail) return 'edge'
  if (props.nodeDetail) return 'node'
  return null
})

const title = computed(() => {
  if (props.edgeDetail) return props.edgeDetail.keywords || '关系详情'
  if (props.nodeDetail) return props.nodeDetail.name
  return ''
})

const subtitle = computed(() => {
  if (props.edgeDetail) {
    return `${props.edgeDetail.sourceName} → ${props.edgeDetail.targetName}`
  }
  return null
})

const nodeTypeColor = computed(() => {
  if (!props.nodeDetail) return '#94a3b8'
  return props.colorMap.get(props.nodeDetail.type) ?? '#94a3b8'
})

function getEdgeSourceName(edge: GraphRelation): string {
  const entity = props.entities.find((e) => e.id === edge.source)
  return entity?.name ?? edge.source
}

function getEdgeTargetName(edge: GraphRelation): string {
  const entity = props.entities.find((e) => e.id === edge.target)
  return entity?.name ?? edge.target
}
</script>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.25s ease;
}
.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(100%);
}
</style>

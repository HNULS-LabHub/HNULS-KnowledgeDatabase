<template>
  <transition name="slide">
    <div
      v-if="detail"
      class="gv-node-detail absolute top-3 right-3 z-10 w-72 bg-white/95 backdrop-blur-sm rounded-xl border border-slate-100 shadow-lg overflow-hidden"
    >
      <!-- 头部 -->
      <div class="flex items-center gap-2 px-4 py-3 border-b border-slate-50">
        <span
          class="w-3 h-3 rounded-full flex-shrink-0"
          :style="{ backgroundColor: typeColor }"
        />
        <h4 class="text-sm font-semibold text-slate-800 truncate flex-1 m-0">
          {{ detail.name }}
        </h4>
        <button
          class="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer border-none bg-transparent"
          @click="$emit('close')"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <!-- 内容 -->
      <div class="px-4 py-3 space-y-2.5">
        <!-- 类型标签 -->
        <div class="flex items-center gap-2">
          <span class="text-xs text-slate-400">类型</span>
          <span
            class="text-xs px-2 py-0.5 rounded-full font-medium"
            :style="{
              backgroundColor: typeColor + '18',
              color: typeColor
            }"
          >
            {{ detail.type }}
          </span>
        </div>

        <!-- 度数 -->
        <div class="flex items-center gap-2">
          <span class="text-xs text-slate-400">连接数</span>
          <span class="text-xs font-medium text-slate-700">{{ detail.degree }}</span>
        </div>

        <!-- 邻居数 -->
        <div class="flex items-center gap-2">
          <span class="text-xs text-slate-400">邻居节点</span>
          <span class="text-xs font-medium text-slate-700">{{ detail.neighbors.length }}</span>
        </div>

        <!-- 描述 -->
        <div v-if="detail.description" class="pt-1 border-t border-slate-50">
          <p class="text-xs text-slate-500 leading-relaxed m-0 line-clamp-4">
            {{ detail.description }}
          </p>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { NodeDetail } from './types'

const props = defineProps<{
  detail: NodeDetail | null
  colorMap: Map<string, string>
}>()

defineEmits<{
  close: []
}>()

const typeColor = computed(() => {
  if (!props.detail) return '#94a3b8'
  return props.colorMap.get(props.detail.type) ?? '#94a3b8'
})
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(12px);
  opacity: 0;
}
</style>

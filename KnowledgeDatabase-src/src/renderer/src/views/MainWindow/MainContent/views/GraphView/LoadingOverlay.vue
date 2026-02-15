<template>
  <div class="gv-loading-overlay absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
    <!-- 动画图标 -->
    <div class="relative mb-6">
      <svg class="w-16 h-16 text-blue-500 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="5" r="2" />
        <circle cx="5" cy="19" r="2" />
        <circle cx="19" cy="19" r="2" />
        <line x1="12" y1="7" x2="5" y2="17" opacity="0.4" />
        <line x1="12" y1="7" x2="19" y2="17" opacity="0.4" />
        <line x1="5" y1="19" x2="19" y2="19" opacity="0.4" />
      </svg>
    </div>

    <!-- 进度信息 -->
    <div class="text-center mb-4">
      <p class="text-sm font-medium text-slate-700 mb-1">正在加载图谱数据...</p>
      <p class="text-xs text-slate-400">
        节点 {{ progress.entitiesLoaded }}/{{ progress.entitiesTotal }}
        &nbsp;·&nbsp;
        关系 {{ progress.relationsLoaded }}/{{ progress.relationsTotal }}
      </p>
    </div>

    <!-- 进度条 -->
    <div class="w-64 h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div
        class="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-300 ease-out"
        :style="{ width: `${percent}%` }"
      />
    </div>
    <p class="text-xs text-slate-400 mt-2">{{ percent }}%</p>
  </div>
</template>

<script setup lang="ts">
import type { LoadingProgress } from './types'

defineProps<{
  progress: LoadingProgress
  percent: number
}>()
</script>

<template>
  <div class="vector-indexer-ring flex items-center gap-3">
    <!-- 圆环进度 -->
    <div class="relative">
      <svg :width="size" :height="size" class="transform -rotate-90">
        <!-- 背景圆环 -->
        <circle
          :cx="center"
          :cy="center"
          :r="radius"
          fill="none"
          :stroke="isActive ? '#e0e7ff' : '#f1f5f9'"
          :stroke-width="strokeWidth"
        />
        <!-- 进度圆环 -->
        <circle
          :cx="center"
          :cy="center"
          :r="radius"
          fill="none"
          :stroke="strokeColor"
          :stroke-width="strokeWidth"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="dashOffset"
          stroke-linecap="round"
          class="transition-all duration-500"
        />
      </svg>
      <!-- 中心进度文本或图标 -->
      <div class="absolute inset-0 flex items-center justify-center">
        <!-- 活跃状态：显示百分比 -->
        <span v-if="isActive && progressText" class="text-[10px] font-bold text-blue-600">
          {{ progressText }}
        </span>
        <!-- 静息状态：显示图标 -->
        <svg
          v-else-if="!isActive"
          class="w-4 h-4 text-slate-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M8 12h8" />
        </svg>
      </div>
    </div>

    <!-- 状态文字 -->
    <div class="flex flex-col min-w-0">
      <span :class="['text-sm font-medium', isActive ? 'text-blue-700' : 'text-slate-500']">
        向量索引
      </span>
      <span class="text-xs text-slate-400 truncate">
        <template v-if="loading">加载中...</template>
        <template v-else-if="isActive">
          {{ processedCount }}/{{ totalCount }} 已索引
          <span v-if="processingCount > 0" class="text-blue-500 ml-1">
            (处理中 {{ processingCount }})
          </span>
        </template>
        <template v-else>静息</template>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { StagingStatus } from '@preload/types'

// ========== Props ==========
const props = withDefaults(
  defineProps<{
    size?: number
    strokeWidth?: number
    pollInterval?: number
  }>(),
  {
    size: 40,
    strokeWidth: 4,
    pollInterval: 500 // 0.5秒更新一次，更及时
  }
)

// ========== State ==========
const status = ref<StagingStatus | null>(null)
const loading = ref(true)
let pollTimer: ReturnType<typeof setInterval> | null = null

// ========== Computed ==========
const center = computed(() => props.size / 2)
const radius = computed(() => (props.size - props.strokeWidth) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)

const isActive = computed(() => status.value?.state === 'active')
const totalCount = computed(() => status.value?.total ?? 0)
const processedCount = computed(() => status.value?.processed ?? 0)
const pendingCount = computed(() => status.value?.pending ?? 0)
const processingCount = computed(() => status.value?.processing ?? 0)

// 进度计算：已处理/总数
const progress = computed(() => {
  if (!status.value) return 0
  if (status.value.state === 'idle') return 0
  // active 状态下显示处理进度（processed/total）
  if (status.value.progress !== null) {
    return status.value.progress
  }
  return 0
})

// 进度百分比文本
const progressText = computed(() => {
  if (!status.value || status.value.state === 'idle') return ''
  const percent = Math.round(progress.value * 100)
  return `${percent}%`
})

const dashOffset = computed(() => {
  const offset = circumference.value * (1 - progress.value)
  return offset
})

const strokeColor = computed(() => {
  if (loading.value) return '#cbd5e1' // slate-300
  return isActive.value ? '#2563eb' : '#94a3b8' // blue-600 : slate-400
})

// ========== Methods ==========
async function fetchStatus() {
  try {
    const result = await window.api.vectorIndexer.getStagingStatus()
    status.value = result
  } catch (error) {
    console.error('[VectorIndexerRing] Failed to fetch status:', error)
  } finally {
    loading.value = false
  }
}

// ========== Lifecycle ==========
onMounted(() => {
  fetchStatus()
  // 定时轮询状态
  pollTimer = setInterval(fetchStatus, props.pollInterval)
})

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<style scoped>
.vector-indexer-ring {
  /* 基础样式 */
}
</style>

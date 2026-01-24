<template>
  <header class="top-bar">
    <!-- 面包屑导航 -->
    <div class="flex items-center gap-1.5 flex-nowrap min-w-0 overflow-hidden">
      <!-- Nexus 根节点 -->
      <span class="flex-shrink-0 text-sm font-medium text-slate-600 select-none">Nexus</span>

      <!-- 分隔符 -->
      <svg
        class="flex-shrink-0 w-3.5 h-3.5 text-slate-300"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>

      <!-- 主页面（可点击返回） -->
      <button
        class="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium transition-all duration-200"
        :class="
          !extraBreadcrumb
            ? 'bg-slate-100 text-slate-900 cursor-default'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer'
        "
        @click="extraBreadcrumb && $emit('navigate-back')"
      >
        <!-- 页面图标 -->
        <svg
          v-if="currentPage === 'dashboard' || currentPage === 'index'"
          class="w-3.5 h-3.5 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M10.586 10.586L16.95 7.05l-3.536 6.364m-2.828-2.828L7.05 16.95l6.364-3.536m-2.828-2.828l2.828 2.828"
          ></path>
          <path
            d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2S2 6.477 2 12s4.477 10 10 10m7-10h-1M6 12H5m7-7v1m0 12v1M7.05 7.05l.707.707m8.486 8.486l.707.707"
          ></path>
        </svg>
        <svg
          v-else-if="currentPage === 'rag'"
          class="w-3.5 h-3.5 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <svg
          v-else-if="currentPage === 'graph'"
          class="w-3.5 h-3.5 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="18" cy="18" r="3"></circle>
          <circle cx="6" cy="6" r="3"></circle>
          <circle cx="6" cy="18" r="3"></circle>
          <line x1="8.59" y1="7.41" x2="15.42" y2="16.59"></line>
          <line x1="8.59" y1="16.59" x2="15.42" y2="7.41"></line>
        </svg>
        <svg
          v-else-if="currentPage === 'user-setting'"
          class="w-3.5 h-3.5 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="3"></circle>
          <path
            d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"
          ></path>
        </svg>
        <!-- 页面标题 -->
        <span class="whitespace-nowrap">{{ pageTitle }}</span>
      </button>

      <!-- 动态子页面（如果有） -->
      <template v-if="extraBreadcrumb">
        <!-- 分隔符 -->
        <svg
          class="flex-shrink-0 w-3.5 h-3.5 text-slate-300"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
        <!-- 当前页面标签 -->
        <span
          class="flex-shrink-0 px-2.5 py-1 rounded-lg text-sm font-semibold text-slate-900 bg-blue-50 border border-blue-100 whitespace-nowrap"
        >
          {{ extraBreadcrumb }}
        </span>
      </template>
    </div>

    <div class="right-actions">
      <div class="search-wrapper">
        <svg
          class="search-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <span class="search-text">全局搜索...</span>
        <span class="search-shortcut">⌘K</span>
      </div>
      <button class="notification-btn">
        <svg
          class="bell-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <span class="notification-badge"></span>
      </button>
      <button class="notification-btn" @click="handleTaskButtonClick">
        <svg
          class="bell-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <span v-if="hasActiveTasks" class="notification-badge bg-blue-500"></span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTaskMonitorStore } from '@renderer/stores/global-monitor-panel/task-monitor.store'

const props = defineProps<{
  currentPage: string
  extraBreadcrumb?: string
}>()

const emit = defineEmits<{
  (e: 'navigate-back'): void
  (e: 'navigate-to-task-monitor'): void
}>()

const taskMonitorStore = useTaskMonitorStore()

const hasActiveTasks = computed(() => {
  return taskMonitorStore.tasks.some(
    (task) => task.status === 'running' || task.status === 'queued'
  )
})

const handleTaskButtonClick = () => {
  emit('navigate-to-task-monitor')
}

const pageTitle = computed(() => {
  const titles = {
    index: '首页',
    dashboard: '首页',
    knowledge: '知识库',
    rag: 'Retrieval',
    graph: 'Graph',
    docs: 'Docs',
    'user-setting': '用户设置'
  }
  return titles[props.currentPage] || props.currentPage
})
</script>

<style scoped>
/* 所有样式已迁移到全局 tailwind.css 中的组件类 */
</style>

<template>
  <nav class="narrow-navbar">
    <div class="nav-logo">
      <div class="logo-gradient">
        <svg
          class="logo-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"
          ></path>
          <path
            d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"
          ></path>
        </svg>
      </div>
    </div>

    <div class="nav-items">
      <button
        v-for="item in navItems"
        :key="item.id"
        :class="['nav-item', { active: activeItem === item.id }]"
        @click="setActive(item.id)"
      >
        <svg
          class="nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          v-html="item.icon"
        ></svg>
        <div class="nav-tooltip">
          {{ item.tooltip }}
          <div class="tooltip-arrow"></div>
        </div>
        <div v-if="activeItem === item.id" class="active-indicator"></div>
      </button>
    </div>

    <div class="nav-bottom">
      <button class="nav-item" @click="setActive('settings')">
        <svg
          class="nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
        </svg>
        <div class="nav-tooltip">
          设置
          <div class="tooltip-arrow"></div>
        </div>
      </button>
      <button class="user-avatar" @click="handleUserSetting">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const activeItem = ref('index')

const emit = defineEmits<{
  navigate: [item: string]
}>()

const navItems = [
  {
    id: 'index',
    tooltip: '首页',
    icon: '<path d="M10.586 10.586L16.95 7.05l-3.536 6.364m-2.828-2.828L7.05 16.95l6.364-3.536m-2.828-2.828l2.828 2.828"></path><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2S2 6.477 2 12s4.477 10 10 10m7-10h-1M6 12H5m7-7v1m0 12v1M7.05 7.05l.707.707m8.486 8.486l.707.707"></path>'
  },
  {
    id: 'knowledge',
    tooltip: '创建知识库',
    icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line><polyline points="14 2 14 8 20 8"></polyline>'
  },
  {
    id: 'task-monitor',
    tooltip: '任务监控',
    icon: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="15" x2="15" y2="15"></line><line x1="12" y1="9" x2="12" y2="15"></line>'
  },
  {
    id: 'rag',
    tooltip: 'RAG 检索',
    icon: '<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path>'
  },
  {
    id: 'graph',
    tooltip: '知识图谱',
    icon: '<circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="8.59" y1="7.41" x2="15.42" y2="16.59"></line><line x1="8.59" y1="16.59" x2="15.42" y2="7.41"></line>'
  },
  {
    id: 'docs',
    tooltip: '文档管理',
    icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14,2 14,8 20,8"></polyline>'
  },
  {
    id: 'test',
    tooltip: '测试工具',
    icon: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>'
  }
]

const setActive = (item: string): void => {
  activeItem.value = item
  // 将 index 映射到 dashboard 页面
  const targetPage = item === 'index' ? 'dashboard' : item
  emit('navigate', targetPage)
}

const handleUserSetting = (): void => {
  // 直接导航到 user-setting 页面
  emit('navigate', 'user-setting')
}
</script>

<style scoped>
/* 所有样式已迁移到全局 tailwind.css 中的组件类 */
</style>

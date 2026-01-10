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
      <div class="user-avatar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </div>
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
  }
]

const setActive = (item: string): void => {
  activeItem.value = item
  // 将 index 映射到 dashboard 页面
  const targetPage = item === 'index' ? 'dashboard' : item
  emit('navigate', targetPage)
}
</script>

<style scoped>
.narrow-navbar {
  width: 4rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 0;
  border-right: 1px solid #e2e8f0;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(12px);
  z-index: 40;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
}

.nav-logo {
  margin-bottom: 2rem;
}

.logo-gradient {
  width: 2.25rem;
  height: 2.25rem;
  background: linear-gradient(to top right, #4f46e5, #7c3aed);
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3);
}

.logo-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: white;
}

.nav-items {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.nav-item {
  position: relative;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.75rem;
  transition: all 300ms;
  background: none;
  border: none;
  cursor: pointer;
  color: #94a3b8;
}

.nav-item:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.nav-item.active {
  background: #0f172a;
  color: white;
  box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.3);
}

.nav-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.nav-tooltip {
  position: absolute;
  left: 3.5rem;
  background: #0f172a;
  color: white;
  font-size: 0.75rem;
  padding: 0.375rem 0.625rem;
  border-radius: 0.5rem;
  opacity: 0;
  transform: translateX(-0.5rem);
  transition: all 300ms;
  pointer-events: none;
  white-space: nowrap;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  z-index: 50;
  font-weight: 500;
}

.nav-item:hover .nav-tooltip {
  opacity: 1;
  transform: translateX(0);
}

.tooltip-arrow {
  position: absolute;
  left: -0.25rem;
  top: 50%;
  transform: translateY(-50%) rotate(45deg);
  width: 0.5rem;
  height: 0.5rem;
  background: #0f172a;
}

.active-indicator {
  position: absolute;
  left: -0.875rem;
  width: 0.25rem;
  height: 1.25rem;
  background: #0f172a;
  border-radius: 0 9999px 9999px 0;
}

.nav-bottom {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.user-avatar {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 9999px;
  background: white;
  border: 1px solid #e2e8f0;
  padding: 0.125rem;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  margin-top: 0.5rem;
  transition: border-color 300ms;
  color: #64748b;
}

.user-avatar:hover {
  border-color: #c7d2fe;
  color: #4f46e5;
}

.user-avatar svg {
  width: 1.25rem;
  height: 1.25rem;
}
</style>

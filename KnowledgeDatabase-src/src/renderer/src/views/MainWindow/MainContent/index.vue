<template>
  <div class="main-content">
    <TopBar
      :current-page="currentPage"
      :extra-breadcrumb="extraBreadcrumb"
      @navigate-back="handleBreadcrumbBack"
    />
    <div class="content-area">
      <NavBar @navigate="handleNavigate" />
      <div class="content-panel">
        <component
          :is="currentComponent"
          ref="viewRef"
          @enter-detail="handleEnterDetail"
          @leave-detail="handleLeaveDetail"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import TopBar from '../TopBar/index.vue'
import NavBar from '../NavBar/index.vue'
import DashboardView from './views/DashboardView.vue'
import RAGView from './views/RAGView.vue'
import GraphView from './views/GraphView.vue'
import DocsView from './views/DocsView.vue'

import KnowledgeView from './views/KnowledgeView/index.vue'
import TaskMonitorView from './views/TaskMonitorView/index.vue'
import UserSettingView from './views/UserSettingView/index.vue'

const currentPage = ref('dashboard')
const extraBreadcrumb = ref('')
const viewRef = ref<any>(null)

const pageConfig = {
  dashboard: DashboardView,
  knowledge: KnowledgeView,
  'task-monitor': TaskMonitorView,
  rag: RAGView,
  graph: GraphView,
  docs: DocsView,
  'user-setting': UserSettingView
}

const currentComponent = computed(() => pageConfig[currentPage.value] || DashboardView)

const handleNavigate = (page: string) => {
  currentPage.value = page
  // Reset breadcrumb when navigating
  extraBreadcrumb.value = ''
}

// Handlers for KnowledgeView Breadcrumb integration
const handleEnterDetail = (name: string) => {
  extraBreadcrumb.value = name
}

const handleLeaveDetail = () => {
  extraBreadcrumb.value = ''
}

const handleBreadcrumbBack = () => {
  if (extraBreadcrumb.value) {
    // If we have an extra breadcrumb, we try to tell the current view to go back
    if (viewRef.value && typeof viewRef.value.handleBack === 'function') {
      viewRef.value.handleBack()
    }
    // Also reset the breadcrumb string
    extraBreadcrumb.value = ''
  } else {
    // If no extra breadcrumb but we're in a detail view, try to go back anyway
    // This handles the case where user clicks on the main breadcrumb item
    if (viewRef.value && typeof viewRef.value.handleBack === 'function') {
      viewRef.value.handleBack()
    }
  }
}
</script>

<style scoped>
@reference "tailwindcss";

.main-content {
  @apply flex flex-col w-full h-full bg-slate-50 overflow-hidden;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
}

.content-area {
  @apply flex flex-1 overflow-hidden bg-slate-50;
}

.content-panel {
  @apply flex-1 overflow-hidden bg-slate-50;
}
</style>

<style>
/* 滚动条样式已迁移到全局 tailwind.css */
</style>

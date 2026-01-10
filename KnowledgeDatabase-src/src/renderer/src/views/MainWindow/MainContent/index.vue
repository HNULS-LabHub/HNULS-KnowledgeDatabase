<template>
  <div class="main-content">
    <TopBar :current-page="currentPage" />
    <div class="content-area">
      <NavBar @navigate="handleNavigate" />
      <div class="content-panel">
        <component :is="currentComponent" />
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

const currentPage = ref('dashboard')

const pageConfig = {
  dashboard: DashboardView,
  knowledge: KnowledgeView,
  rag: RAGView,
  graph: GraphView,
  docs: DocsView
}

const currentComponent = computed(() => pageConfig[currentPage.value] || DashboardView)

const handleNavigate = (page: string) => {
  currentPage.value = page
}
</script>

<style scoped>
.main-content {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #f8fafc;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
  overflow: hidden;
}

.content-area {
  display: flex;
  flex: 1;
  overflow: hidden;
  background: #f8fafc;
}

.content-panel {
  flex: 1;
  overflow: hidden;
  background: #f8fafc;
}
</style>

<style>
/* 自定义滚动条样式 - 全局应用 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb {
  background: rgba(203, 213, 225, 0.3);
  border-radius: 3px;
  transition: all 0.3s ease;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.4);
}

::-webkit-scrollbar-thumb:active {
  background: rgba(100, 116, 139, 0.5);
}

/* Firefox 滚动条样式 */
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(203, 213, 225, 0.4) transparent;
}
</style>

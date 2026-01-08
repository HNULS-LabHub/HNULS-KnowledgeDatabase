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

const currentPage = ref('dashboard')

const pageConfig = {
  dashboard: DashboardView,
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
  font-family: system-ui, -apple-system, sans-serif;
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
  overflow: auto;
  background: #f8fafc;
}
</style>
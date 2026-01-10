<template>
  <div class="KnowledgeView_KnowledgeDetail_index_container">
    <!-- Sidebar -->
    <Sidebar 
      :kb="kb" 
      v-model:currentNav="currentNav"
    />

    <!-- Main Content Area -->
    <div class="KnowledgeView_KnowledgeDetail_content_area">
      <!-- 动态内容：根据左侧导航选择 -->
      <template v-if="currentNav === 'files'">
        <ContentHeader 
          title="文件列表"
          v-model:currentView="currentViewType"
        />
        
        <div class="KnowledgeView_KnowledgeDetail_content_scrollable">
          <component :is="CurrentViewComponent" />
        </div>
      </template>

      <!-- 其他导航项占位 -->
      <div v-else class="KnowledgeView_KnowledgeDetail_placeholder">
        <h3>{{ currentNav }} 功能开发中...</h3>
      </div>
    </div>

    <!-- 右侧抽屉 (DetailDrawer) - 待实现 -->
    <!-- <DetailDrawer /> -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Sidebar from './Sidebar.vue'
import ContentHeader from './ContentHeader.vue'
import { FileListView, FileCardView, FileTreeView } from './Views'
import type { KnowledgeBase, ViewType, NavItem } from '../types'

const props = defineProps<{
  kb: KnowledgeBase
}>()

const currentNav = ref<NavItem>('files')
const currentViewType = ref<ViewType>('list')

const CurrentViewComponent = computed(() => {
  switch (currentViewType.value) {
    case 'card': return FileCardView
    case 'tree': return FileTreeView
    case 'list': 
    default: return FileListView
  }
})
</script>

<style scoped>
.KnowledgeView_KnowledgeDetail_index_container {
  display: flex;
  width: 100%;
  height: 100%;
  background: #f8fafc;
  overflow: hidden;
}

.KnowledgeView_KnowledgeDetail_content_area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.KnowledgeView_KnowledgeDetail_content_scrollable {
  flex: 1;
  overflow-y: auto;
  /* 平滑滚动 */
  scroll-behavior: smooth;
}

.KnowledgeView_KnowledgeDetail_placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #94a3b8;
}
</style>

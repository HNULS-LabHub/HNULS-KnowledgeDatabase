<template>
  <div class="KnowledgeView_KnowledgeDetail_index_container">
    <!-- Sidebar -->
    <Sidebar :kb="kb" v-model:currentNav="currentNav" />

    <!-- Main Content Area -->
    <div class="KnowledgeView_KnowledgeDetail_content_area">
      <!-- 动态内容：根据左侧导航选择 -->
      <template v-if="currentNav === 'files'">
        <ContentHeader
          title="文件列表"
          v-model:currentView="currentViewType"
          :page-size="pageSize"
          @update:pageSize="pageSize = $event"
        />

        <DropZone :knowledge-base-id="kb.id" @import-started="handleImportStarted">
          <div class="KnowledgeView_KnowledgeDetail_content_scrollable">
            <component
              :is="CurrentViewComponent"
              :knowledge-base-id="kb.id"
              :page-size="currentViewType === 'list' ? pageSize : undefined"
              @show-detail="handleShowDetail"
            />
          </div>
        </DropZone>
      </template>

      <!-- 其他导航项占位 -->
      <div v-else class="KnowledgeView_KnowledgeDetail_placeholder">
        <h3>{{ currentNav }} 功能开发中...</h3>
      </div>
    </div>

    <!-- 右侧抽屉 -->
    <DetailDrawer v-model:visible="drawerVisible" :file-data="selectedFile" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useFileListStore } from '@renderer/stores/knowledge-library/file-list.store'
import { useFileCardStore } from '@renderer/stores/knowledge-library/file-card.store'
import { useFileTreeStore } from '@renderer/stores/knowledge-library/file-tree.store'
import Sidebar from './Sidebar.vue'
import ContentHeader from './ContentHeader.vue'
import DetailDrawer from './DetailDrawer.vue'
import DropZone from './DropZone.vue'
import { FileListView, FileCardView, FileTreeView } from './Views'
import type { KnowledgeBase, ViewType, NavItem, FileNode } from '../types'

const props = defineProps<{
  kb: KnowledgeBase
}>()

const currentNav = ref<NavItem>('files')
const currentViewType = ref<ViewType>('list')
const pageSize = ref(20)
const drawerVisible = ref(false)
const selectedFile = ref<FileNode | null>(null)

// 获取各个 Store 实例
const fileListStore = useFileListStore()
const fileCardStore = useFileCardStore()
const fileTreeStore = useFileTreeStore()

const CurrentViewComponent = computed(() => {
  switch (currentViewType.value) {
    case 'card':
      return FileCardView
    case 'tree':
      return FileTreeView
    case 'list':
    default:
      return FileListView
  }
})

// 监听视图切换，确保数据已加载
watch(
  [() => currentViewType.value, () => props.kb.id],
  async ([viewType, kbId]) => {
    if (currentNav.value === 'files') {
      switch (viewType) {
        case 'list':
          await fileListStore.fetchFiles(kbId)
          break
        case 'card':
          await fileCardStore.fetchFiles(kbId)
          break
        case 'tree':
          await fileTreeStore.fetchFiles(kbId)
          break
      }
    }
  },
  { immediate: true }
)

const handleShowDetail = (file: FileNode) => {
  selectedFile.value = file
  drawerVisible.value = true
}

const handleImportStarted = () => {
  // 导入已启动，任务会在后台处理，完成后会自动刷新
  // 用户可以在任务进度对话框中查看进度
  console.log('[KnowledgeDetail] Import started for KB', props.kb.id)
}
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

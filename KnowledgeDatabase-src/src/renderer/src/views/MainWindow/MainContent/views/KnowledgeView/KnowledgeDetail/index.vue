<template>
  <div
    class="KnowledgeView_KnowledgeDetail_index_container flex w-full h-full bg-slate-50 overflow-hidden"
  >
    <!-- Sidebar -->
    <Sidebar :kb="kb" v-model:currentNav="currentNav" />

    <!-- Main Content Area -->
    <div
      class="KnowledgeView_KnowledgeDetail_content_area content-area flex-1 flex flex-col overflow-hidden relative"
    >
      <!-- 动态内容：根据左侧导航选择 -->
      <template v-if="currentNav === 'files'">
        <ContentHeader
          title="文件列表"
          v-model:currentView="currentViewType"
          :page-size="pageSize"
          :knowledge-base-id="kb.id"
          @update:pageSize="pageSize = $event"
        />

        <DropZone
          :knowledge-base-id="kb.id"
          :is-tree-view="currentViewType === 'tree'"
          @import-started="handleImportStarted"
        >
          <div
            class="KnowledgeView_KnowledgeDetail_content_scrollable scrollable-content flex-1 overflow-y-auto overflow-x-hidden min-h-0 scroll-smooth"
          >
            <component
              :is="CurrentViewComponent"
              :knowledge-base-id="kb.id"
              :page-size="currentViewType === 'list' ? pageSize : undefined"
              @show-detail="handleShowDetail"
            />
          </div>
        </DropZone>
      </template>

      <!-- 配置页面 -->
      <SettingsView
        v-else-if="currentNav === 'settings'"
        :knowledge-base-id="kb.id"
        @open-embedding-detail="handleOpenEmbeddingDetail"
      />

      <!-- 嵌入配置详情页 (在 content-area 层级切换) -->
      <EmbeddingDetailView
        v-else-if="currentNav === 'embedding-detail' && selectedEmbeddingConfig"
        :knowledge-base-id="kb.id"
        :config-id="selectedEmbeddingConfig.id"
        :config-name="selectedEmbeddingConfig.name"
        :initial-candidates="selectedEmbeddingConfig.candidates || []"
        @back="handleBackFromEmbeddingDetail"
      />

      <!-- 其他导航项占位 -->
      <div
        v-else
        class="KnowledgeView_KnowledgeDetail_placeholder placeholder flex items-center justify-center h-full text-slate-400"
      >
        <h3>{{ currentNav }} 功能开发中...</h3>
      </div>
    </div>

    <!-- 右侧抽屉 -->
    <DetailDrawer
      v-model:visible="drawerVisible"
      :file-data="selectedFile"
      :knowledge-base-id="kb.id"
      @file-deleted="handleFileDeleted"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useFileListStore } from '@renderer/stores/knowledge-library/file-list.store'
import { useFileCardStore } from '@renderer/stores/knowledge-library/file-card.store'
import { useFileTreeStore } from '@renderer/stores/knowledge-library/file-tree.store'
import Sidebar from './Sidebar.vue'
import ContentHeader from './ContentHeader.vue'
import DetailDrawer from './DetailDrawer/index.vue'
import DropZone from './DropZone.vue'
import SettingsView from './SettingsView/index.vue'
import EmbeddingDetailView from './SettingsView/EmbeddingSection/EmbeddingDetailView.vue'
import { FileListView, FileCardView, FileTreeView } from './Views'
import type { KnowledgeBase, ViewType, NavItem, FileNode } from '../types'

import { useKnowledgeConfigStore } from '@renderer/stores/knowledge-library/knowledge-config.store'

const props = defineProps<{
  kb: KnowledgeBase
}>()

const emit = defineEmits<{
  (e: 'enter-embedding-detail', name: string): void
  (e: 'leave-embedding-detail'): void
}>()

const currentNav = ref<NavItem>('files')
const currentViewType = ref<ViewType>('list')
const pageSize = ref(20)
const drawerVisible = ref(false)
const selectedFile = ref<FileNode | null>(null)

// 嵌入配置相关
const knowledgeConfigStore = useKnowledgeConfigStore()
const selectedEmbeddingConfig = ref<{ id: string; name: string; candidates: any[] } | null>(null)

function handleOpenEmbeddingDetail(config: any) {
  selectedEmbeddingConfig.value = config
  currentNav.value = 'embedding-detail'
  emit('enter-embedding-detail', `嵌入配置 > ${config.name}`)
}

function handleBackFromEmbeddingDetail() {
  currentNav.value = 'settings'
  emit('leave-embedding-detail')
}

// 暴露 handleBack 供面包屑点击返回
function handleBack() {
  if (currentNav.value === 'embedding-detail') {
    currentNav.value = 'settings'
    emit('leave-embedding-detail')
    return true // 表示已经处理了返回
  }
  return false
}

defineExpose({ handleBack })

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

// 处理文件删除事件
const handleFileDeleted = () => {
  // 文件已删除，抽屉已关闭，这里可以添加额外的处理逻辑
  console.log('[index.vue] File deleted')
  // 清空选中的文件
  selectedFile.value = null
}
</script>

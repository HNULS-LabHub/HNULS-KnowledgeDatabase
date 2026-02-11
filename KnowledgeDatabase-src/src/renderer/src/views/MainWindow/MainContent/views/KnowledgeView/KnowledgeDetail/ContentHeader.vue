<template>
  <div class="kb-content-header">
    <!-- Tab 标签栏 -->
    <div class="kb-content-header-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="kb-content-header-tab"
        :class="{ 'kb-content-header-tab-active': activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- 功能区内容 -->
    <div class="kb-content-header-ribbon">
      <!-- 开始 Tab 内容 -->
      <template v-if="activeTab === 'start'">
        <div class="kb-content-header-ribbon-content">
          <!-- 视图组 -->
          <div class="kb-content-header-group">
            <div class="kb-content-header-group-content">
              <div class="kb-content-header-view-switcher">
                <button
                  v-for="view in viewOptions"
                  :key="view.id"
                  class="kb-content-header-view-btn"
                  :class="{
                    'kb-content-header-view-btn-active': currentView === view.id
                  }"
                  :title="view.label"
                  @click="$emit('update:currentView', view.id)"
                >
                  <span v-html="view.icon"></span>
                </button>
              </div>
            </div>
          </div>

          <!-- 筛选按钮 -->
          <button
            class="kb-content-header-icon-btn"
            title="筛选文档状态"
            @click="showFilterDialog = true"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 5h16" />
              <path d="M7 12h10" />
              <path d="M10 19h4" />
            </svg>
          </button>

          <!-- 刷新按钮 -->
          <button
            class="kb-content-header-icon-btn"
            :class="{ 'kb-content-header-icon-btn-spinning': isRefreshing }"
            :disabled="isRefreshing"
            title="刷新文件列表"
            @click="handleRefresh"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
          </button>

          <!-- 搜索组 -->
          <div class="kb-content-header-group">
            <div class="kb-content-header-group-content">
              <div class="kb-content-header-search-wrapper">
                <svg
                  class="kb-content-header-search-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
                <input
                  type="text"
                  placeholder="搜索文件..."
                  class="kb-content-header-search-input"
                />
              </div>
            </div>
          </div>

          <!-- 显示组 -->
          <div v-if="currentView === 'list'" class="kb-content-header-group">
            <div class="kb-content-header-group-content">
              <PageSizeSelector
                :model-value="pageSize || 20"
                @update:model-value="$emit('update:pageSize', $event)"
              />
            </div>
          </div>

          <!-- 文件组 -->
          <div class="kb-content-header-group">
            <div class="kb-content-header-group-content">
              <button class="kb-content-header-primary-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                上传文件
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- 操作 Tab 内容 -->
      <template v-else-if="activeTab === 'action'">
        <div class="kb-content-header-ribbon-content">
          <!-- 选择组 -->
          <div class="kb-content-header-group">
            <div class="kb-content-header-group-label">选择</div>
            <div class="kb-content-header-group-content">
              <button
                class="kb-content-header-icon-btn"
                :class="{ 'kb-content-header-icon-btn-active': isSelectionModeEnabled }"
                title="选择"
                @click="handleToggleSelectionMode"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                </svg>
              </button>
              <button
                class="kb-content-header-icon-btn"
                :disabled="!isSelectionModeEnabled"
                title="全选"
                @click="handleSelectAll"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 11 12 14 22 4"></polyline>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
              </button>
            </div>
          </div>

          <!-- 操作组 -->
          <div class="kb-content-header-group">
            <div class="kb-content-header-group-content">
              <button
                class="kb-content-header-action-btn"
                :disabled="!isSelectionModeEnabled || isBatchParsing"
                @click="handleBatchParsing"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                {{ isBatchParsing ? '解析中...' : '解析文档' }}
              </button>
              <button
                class="kb-content-header-action-btn"
                :disabled="!isSelectionModeEnabled || isBatchChunking"
                @click="handleBatchChunking"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
                {{ isBatchChunking ? '分块中...' : '分块' }}
              </button>
              <button
                class="kb-content-header-action-btn"
                :disabled="!isSelectionModeEnabled"
                @click="showBatchEmbeddingDialog = true"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path
                    d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
                  ></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
                嵌入
              </button>
              <button class="kb-content-header-action-btn" :disabled="!isSelectionModeEnabled" @click="showBatchKgDialog = true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="18" cy="18" r="3"></circle>
                  <circle cx="6" cy="6" r="3"></circle>
                  <circle cx="6" cy="18" r="3"></circle>
                  <line x1="8.59" y1="7.41" x2="15.42" y2="16.59"></line>
                  <line x1="8.59" y1="16.59" x2="15.42" y2="7.41"></line>
                </svg>
                加入知识图谱
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>

  <!-- 批量嵌入对话框 -->
  <BatchEmbeddingDialog
    v-model="showBatchEmbeddingDialog"
    :selected-count="selectedCount"
    :knowledge-base-id="knowledgeBaseId"
    @confirm="handleBatchEmbedding"
  />

  <!-- 批量知识图谱对话框 -->
  <BatchKgDialog
    v-model="showBatchKgDialog"
    :selected-count="selectedCount"
    :knowledge-base-id="knowledgeBaseId"
    @confirm="handleBatchKgBuild"
  />

  <!-- 状态筛选对话框 -->
  <StatusFilterDialog
    v-model="showFilterDialog"
    :initial-state="statusFilterState"
    @apply="handleApplyFilter"
    @reset="handleResetFilter"
  />
</template>

<script setup lang="ts">
import { ref, computed, reactive, inject } from 'vue'
import { useFileDataStore } from '@renderer/stores/knowledge-library/file-data.store'
import { useFileListStore } from '@renderer/stores/knowledge-library/file-list.store'
import { useFileCardStore } from '@renderer/stores/knowledge-library/file-card.store'
import { useFileTreeStore } from '@renderer/stores/knowledge-library/file-tree.store'
import { useFileSelectionStore } from '@renderer/stores/knowledge-library/file-selection.store'
import { useBatchOperations } from '@renderer/composables/useBatchOperations'
import type { ViewType } from '../types'
import type { FileNode } from '@renderer/stores/knowledge-library/file.types'
import PageSizeSelector from './PageSizeSelector.vue'
import { BatchEmbeddingDialog, BatchKgDialog, StatusFilterDialog } from './ContentHeaderComponents'

const props = defineProps<{
  title: string
  currentView: ViewType
  pageSize?: number
  knowledgeBaseId: number
}>()

defineEmits<{
  (e: 'update:currentView', val: ViewType): void
  (e: 'update:pageSize', val: number): void
}>()

const activeTab = ref<'start' | 'action'>('start')

const tabs = [
  { id: 'start' as const, label: '开始' },
  { id: 'action' as const, label: '操作' }
]

// 使用 Stores
const fileDataStore = useFileDataStore()
const fileListStore = useFileListStore()
const fileCardStore = useFileCardStore()
const fileTreeStore = useFileTreeStore()
const selectionStore = useFileSelectionStore()

// 使用批量操作 Composable
const {
  isBatchParsing,
  isBatchChunking,
  isBatchKgBuilding,
  batchParseDocuments,
  batchChunkDocuments,
  batchBuildKnowledgeGraph
} = useBatchOperations()

// 批量嵌入对话框状态
const showBatchEmbeddingDialog = ref(false)

// 批量知识图谱对话框状态
const showBatchKgDialog = ref(false)

// 注入 toast
const toast = inject<{ success: Function; error: Function; warning: Function; info: Function }>('toast')

// 状态筛选对话框
const showFilterDialog = ref(false)
const isRefreshing = ref(false)

type StatusKey = 'embedded' | 'parsed' | 'parsing' | 'pending' | 'failed'
type StatusState = 'include' | 'exclude' | 'ignore'

const statusFilterState = reactive<Record<StatusKey, StatusState>>({
  embedded: 'ignore',
  parsed: 'ignore',
  parsing: 'ignore',
  pending: 'ignore',
  failed: 'ignore'
})

const handleApplyFilter = (predicate: (file: FileNode) => boolean) => {
  fileListStore.setStatusFilter(predicate)
  fileCardStore.setStatusFilter(predicate)
}

const handleResetFilter = () => {
  ;(Object.keys(statusFilterState) as StatusKey[]).forEach((k) => {
    statusFilterState[k] = 'ignore'
  })
  fileListStore.resetStatusFilter()
  fileCardStore.resetStatusFilter()
}

/**
 * 手动刷新文件列表（走打开知识库的同一管线：fetchFiles）
 */
async function handleRefresh(): Promise<void> {
  if (isRefreshing.value) return
  isRefreshing.value = true
  try {
    await fileDataStore.refresh()
  } finally {
    isRefreshing.value = false
  }
}

// 选择模式状态
const isSelectionModeEnabled = computed(() => {
  return selectionStore.isSelectionModeEnabled(props.knowledgeBaseId)
})

// 选中文件数量
const selectedCount = computed(() => {
  return selectionStore.getSelectedFiles(props.knowledgeBaseId).length
})

// 切换选择模式
const handleToggleSelectionMode = (): void => {
  selectionStore.toggleSelectionMode(props.knowledgeBaseId)
}

// 全选功能
const handleSelectAll = (): void => {
  if (!isSelectionModeEnabled.value) return

  const kbId = props.knowledgeBaseId
  let allFileIds: (string | number)[]

  // 根据当前视图获取所有文件ID
  if (props.currentView === 'list') {
    allFileIds = fileDataStore.files.map((f) => f.id)
  } else if (props.currentView === 'card') {
    allFileIds = fileCardStore.filteredFiles.map((f) => f.id)
  } else if (props.currentView === 'tree') {
    allFileIds = selectionStore.getAllNodeIds(fileTreeStore.treeStructure)
  } else {
    return
  }

  if (allFileIds.length === 0) return

  // 检查是否已全选
  const isAllSelected = selectionStore.isAllSelected(kbId, allFileIds)

  if (isAllSelected) {
    // 如果已全选，则全不选
    selectionStore.deselectAll(kbId)
  } else {
    // 如果未全选，则全选
    selectionStore.selectAll(kbId, allFileIds)
  }
}

const viewOptions: { id: ViewType; label: string; icon: string }[] = [
  {
    id: 'tree',
    label: '树形视图',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="21" y1="12" x2="9" y2="12"></line><line x1="21" y1="6" x2="9" y2="6"></line><line x1="21" y1="18" x2="9" y2="18"></line><circle cx="5" cy="12" r="1"></circle><circle cx="5" cy="6" r="1"></circle><circle cx="5" cy="18" r="1"></circle></svg>`
  },
  {
    id: 'list',
    label: '列表视图',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`
  },
  {
    id: 'card',
    label: '卡片视图',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`
  }
]

// ========== 批量操作辅助函数 ==========

/**
 * 获取所有选中的文件节点
 */
function getSelectedFiles(): FileNode[] {
  const selectedIds = selectionStore.getSelectedFiles(props.knowledgeBaseId)
  if (selectedIds.length === 0) return []

  let allFiles: FileNode[] = []

  // 根据当前视图获取文件列表
  if (props.currentView === 'list') {
    allFiles = fileDataStore.files
  } else if (props.currentView === 'card') {
    allFiles = fileCardStore.filteredFiles
  } else if (props.currentView === 'tree') {
    // 从树形结构中提取所有文件节点
    const extractFiles = (nodes: FileNode[]): FileNode[] => {
      const files: FileNode[] = []
      for (const node of nodes) {
        if (node.type === 'file') {
          files.push(node)
        }
        if ('children' in node && Array.isArray((node as any).children)) {
          files.push(...extractFiles((node as any).children))
        }
      }
      return files
    }
    allFiles = extractFiles(fileTreeStore.treeStructure)
  }

  // 过滤出选中的文件
  return allFiles.filter((file) => selectedIds.includes(file.id))
}

/**
 * 批量解析文档
 */
async function handleBatchParsing(): Promise<void> {
  const selectedFiles = getSelectedFiles()
  if (selectedFiles.length === 0) {
    console.warn('[BatchParsing] 请先选择要解析的文件')
    return
  }

  const result = await batchParseDocuments(selectedFiles, props.knowledgeBaseId)
  console.log(`[ContentHeader] 批量解析完成：成功 ${result.success} 个，失败 ${result.failed} 个`)
}

/**
 * 批量分块
 */
async function handleBatchChunking(): Promise<void> {
  const selectedFiles = getSelectedFiles()
  if (selectedFiles.length === 0) {
    console.warn('[BatchChunking] 请先选择要分块的文件')
    return
  }

  const result = await batchChunkDocuments(selectedFiles, props.knowledgeBaseId)
  console.log(`[ContentHeader] 批量分块完成：成功 ${result.success} 个，失败 ${result.failed} 个`)
}

/**
 * 批量嵌入
 */
async function handleBatchEmbedding(configId: string): Promise<void> {
  const selectedFiles = getSelectedFiles()
  if (selectedFiles.length === 0) {
    console.warn('[BatchEmbedding] 请先选择要嵌入的文件')
    return
  }

  // 导入批量嵌入方法
  const { batchEmbedDocuments } = useBatchOperations()
  const result = await batchEmbedDocuments(selectedFiles, props.knowledgeBaseId, configId)
  console.log(`[ContentHeader] 批量嵌入完成：成功 ${result.success} 个，失败 ${result.failed} 个`)
}

/**
 * 批量构建知识图谱
 */
async function handleBatchKgBuild(kgConfigId: string): Promise<void> {
  const selectedFiles = getSelectedFiles()
  if (selectedFiles.length === 0) {
    toast?.warning('批量知识图谱', '请先选择要构建的文件')
    return
  }

  toast?.info('批量知识图谱', `开始为 ${selectedFiles.length} 个文件构建知识图谱...`)

  const result = await batchBuildKnowledgeGraph(selectedFiles, props.knowledgeBaseId, kgConfigId)

  // 汇总结果
  const parts: string[] = []
  if (result.success > 0) parts.push(`成功 ${result.success} 个`)
  if (result.failed > 0) parts.push(`失败 ${result.failed} 个`)
  if (result.skipped > 0) parts.push(`跳过 ${result.skipped} 个`)

  // 失败详情
  const failedDetails = result.details
    .filter((d) => d.status === 'failed' || d.status === 'skipped')
    .map((d) => `${d.name}: ${d.reason}`)
    .slice(0, 5)

  const summary = parts.join('，')
  const detail = failedDetails.length > 0 ? `\n${failedDetails.join('\n')}` : ''

  if (result.failed > 0) {
    toast?.error('批量知识图谱', `${summary}${detail}`, 8000)
  } else if (result.skipped > 0 && result.success > 0) {
    toast?.warning('批量知识图谱', `${summary}${detail}`, 6000)
  } else if (result.success > 0) {
    toast?.success('批量知识图谱', summary)
  } else {
    toast?.warning('批量知识图谱', `所有文件均被跳过${detail}`, 6000)
  }
}
</script>

<style scoped>
/* 主容器 - 保持原有高度 */
.kb-content-header {
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(226, 232, 240, 0.6);
  position: sticky;
  top: 0;
  z-index: 10;
}

/* Tab 标签栏 */
.kb-content-header-tabs {
  display: flex;
  align-items: flex-end;
  padding: 0 2rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  gap: 0.25rem;
  height: 2rem;
  flex-shrink: 0;
  min-width: max-content;
}

.kb-content-header-tab {
  padding: 0.5rem 1.25rem;
  background: transparent;
  border: none;
  border-top: 2px solid transparent;
  border-left: 1px solid transparent;
  border-right: 1px solid transparent;
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms;
  position: relative;
  bottom: -1px;
  height: 100%;
  display: flex;
  align-items: center;
}

.kb-content-header-tab:hover {
  color: #0f172a;
  background: rgba(255, 255, 255, 0.5);
}

.kb-content-header-tab-active {
  color: #0f172a;
  background: rgba(255, 255, 255, 0.8);
  border-top-color: #4f46e5;
  border-left-color: #e2e8f0;
  border-right-color: #e2e8f0;
  border-bottom-color: transparent;
}

/* 功能区 */
.kb-content-header-ribbon {
  padding: 0.5rem 2rem;
  background: rgba(255, 255, 255, 0.8);
  height: 4rem;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  scrollbar-color: rgba(203, 213, 225, 0.3) transparent;
}

.kb-content-header-ribbon::-webkit-scrollbar {
  height: 2px;
}

.kb-content-header-ribbon::-webkit-scrollbar-track {
  background: transparent;
}

.kb-content-header-ribbon::-webkit-scrollbar-thumb {
  background: rgba(203, 213, 225, 0.3);
  border-radius: 2px;
}

.kb-content-header-ribbon::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.4);
}

.kb-content-header-ribbon-content {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  min-width: max-content;
  flex-shrink: 0;
}

/* 功能组 */
.kb-content-header-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-right: 1.5rem;
  border-right: 1px solid #e2e8f0;
  flex-shrink: 0;
  gap: 0.125rem;
}

.kb-content-header-group:last-child {
  border-right: none;
  padding-right: 0;
}

.kb-content-header-group-label {
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 500;
  text-align: center;
  line-height: 1;
  white-space: nowrap;
}

.kb-content-header-group-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

/* 视图切换器 */
.kb-content-header-view-switcher {
  display: flex;
  background: #f1f5f9;
  padding: 0.125rem;
  border-radius: 0.5rem;
}

.kb-content-header-view-btn {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: #64748b;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 200ms;
}

.kb-content-header-view-btn:hover {
  color: #0f172a;
}

.kb-content-header-view-btn-active {
  background: white;
  color: #0f172a;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.kb-content-header-view-btn :deep(svg) {
  width: 1rem;
  height: 1rem;
}

/* 搜索框 */
.kb-content-header-search-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  transition: all 200ms;
  width: 240px;
}

.kb-content-header-search-wrapper:focus-within {
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.kb-content-header-search-icon {
  width: 1rem;
  height: 1rem;
  color: #94a3b8;
  flex-shrink: 0;
}

.kb-content-header-search-input {
  border: none;
  background: transparent;
  outline: none;
  font-size: 0.875rem;
  width: 100%;
  color: #0f172a;
}

.kb-content-header-search-input::placeholder {
  color: #cbd5e1;
}

/* 主要按钮 */
.kb-content-header-primary-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #0f172a;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms;
}

.kb-content-header-primary-btn:hover {
  background: #1e293b;
}

.kb-content-header-primary-btn svg {
  width: 1rem;
  height: 1rem;
}

/* 操作按钮 */
.kb-content-header-action-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: white;
  color: #0f172a;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms;
}

.kb-content-header-action-btn:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #4f46e5;
  color: #4f46e5;
}

.kb-content-header-action-btn svg {
  width: 1rem;
  height: 1rem;
}

.kb-content-header-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.kb-content-header-action-btn:disabled:hover {
  background: white;
  border-color: #e2e8f0;
  color: #0f172a;
}

/* 单图标按钮 */
.kb-content-header-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  background: white;
  color: #0f172a;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms;
}

.kb-content-header-icon-btn:hover {
  background: #f8fafc;
  border-color: #4f46e5;
  color: #4f46e5;
}

.kb-content-header-icon-btn svg {
  width: 1.125rem;
  height: 1.125rem;
}

.kb-content-header-icon-btn-active {
  background: #4f46e5;
  color: white;
  border-color: #4f46e5;
}

.kb-content-header-icon-btn-active:hover {
  background: #4338ca;
  border-color: #4338ca;
}

.kb-content-header-icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.kb-content-header-icon-btn:disabled:hover {
  background: white;
  border-color: #e2e8f0;
  color: #0f172a;
}

/* 刷新旋转动画 */
.kb-content-header-icon-btn-spinning svg {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>

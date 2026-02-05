<template>
  <div class="file-list-container">
    <!-- 表格容器：支持横向滚动 -->
    <div class="table-wrapper">
      <div class="table-content" :style="{ width: totalWidth + 'px' }">
        <!-- 表头 -->
        <div class="table-header">
          <!-- 复选框列 -->
          <div
            v-if="isSelectionModeEnabled"
            class="header-cell checkbox-col"
            :style="{ width: columns[0].width + 'px' }">
            <input
              type="checkbox"
              class="checkbox-input"
              :checked="isAllSelected"
              :indeterminate="isIndeterminate"
              @change="handleSelectAll"
            />
          </div>

          <!-- 动态列 -->
          <div
            v-for="(col, index) in displayColumns"
            :key="col.id"
            class="header-cell"
            :style="{ width: col.width + 'px' }"
          >
            <span class="header-label">{{ col.label }}</span>

            <!-- 拖拽调整手柄 -->
            <div
              v-if="index < displayColumns.length - 1"
              class="resize-handle"
              :class="{ active: activeResizer === index }"
              @mousedown="handleMouseDown($event, index)"
            >
              <div class="resize-line" />
            </div>
          </div>
        </div>

        <!-- 加载状态 -->
        <div v-if="loading" class="table-row empty-state">
          <div class="empty-content" :style="{ width: totalWidth + 'px' }">
            <svg class="loading-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
            </svg>
            <span>加载中...</span>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else-if="paginatedFiles.length === 0" class="table-row empty-state">
          <div class="empty-content" :style="{ width: totalWidth + 'px' }">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="empty-icon">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
              <polyline points="13 2 13 9 20 9"/>
            </svg>
            <span>暂无文件</span>
          </div>
        </div>

        <!-- 文件列表 -->
        <div v-else class="table-body">
          <div
            v-for="file in paginatedFiles"
            :key="file.id"
            class="table-row"
            @contextmenu.prevent="handleContextMenu($event, file)"
          >
            <!-- 复选框列 -->
            <div
              v-if="isSelectionModeEnabled"
              class="table-cell checkbox-cell"
              :style="{ width: columns[0].width + 'px' }"
            >
              <input
                type="checkbox"
                class="checkbox-input"
                :checked="isFileSelected(file.id)"
                @change="handleToggleSelection(file.id)"
                @click.stop
              />
            </div>

            <!-- 名称列：智能中间省略 -->
            <div
              class="table-cell name-cell"
              :style="{ width: displayColumns[0].width + 'px' }"
            >
              <div class="file-icon-wrapper">
                <component :is="getFileIcon(file.extension)" class="file-icon" />
              </div>
              <SmartTruncateName :name="file.name" />
            </div>

            <!-- 状态列 -->
            <div
              class="table-cell"
              :style="{ width: displayColumns[1].width + 'px' }"
            >
              <StatusBadge :status="file.status" />
            </div>

            <!-- 大小列 -->
            <div
              class="table-cell text-secondary"
              :style="{ width: displayColumns[2].width + 'px' }"
            >
              {{ file.size || '-' }}
            </div>

            <!-- 分块数列 -->
            <div
              class="table-cell text-secondary"
              :style="{ width: displayColumns[3].width + 'px' }"
            >
              {{ file.chunkCount || '-' }}
            </div>

            <!-- 更新时间列 -->
            <div
              class="table-cell text-secondary"
              :style="{ width: displayColumns[4].width + 'px' }"
            >
              {{ formatUpdateTime(file.updateTime) }}
            </div>

            <!-- 操作列 -->
            <div
              class="table-cell action-cell"
              :style="{ width: displayColumns[5].width + 'px' }"
            >
              <div class="action-buttons">
                <button class="action-btn" title="详情" @click="$emit('show-detail', file)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                </button>
                <button class="action-btn delete" title="删除">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18"></path>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div class="KnowledgeView_KnowledgeDetail_Views_FileListView_pagination">
      <div class="KnowledgeView_KnowledgeDetail_Views_FileListView_paginationInfo">
        显示第 {{ startIndex + 1 }}-{{ endIndex }} 条，共 {{ totalFiles }} 条
      </div>
      <div class="KnowledgeView_KnowledgeDetail_Views_FileListView_paginationControls">
        <button
          class="KnowledgeView_KnowledgeDetail_Views_FileListView_paginationBtn"
          :disabled="currentPage === 1"
          @click="goToPage(currentPage - 1)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          上一页
        </button>

        <div class="KnowledgeView_KnowledgeDetail_Views_FileListView_pageNumbers">
          <button
            v-for="page in visiblePages"
            :key="page"
            class="KnowledgeView_KnowledgeDetail_Views_FileListView_pageBtn"
            :class="{ active: page === currentPage }"
            @click="goToPage(page)"
          >
            {{ page }}
          </button>
        </div>

        <button
          class="KnowledgeView_KnowledgeDetail_Views_FileListView_paginationBtn"
          :disabled="currentPage === totalPages"
          @click="goToPage(currentPage + 1)"
        >
          下一页
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
    </div>

    <!-- Context Menu -->
    <Teleport to="body">
      <Transition name="context-fade">
        <div
          v-if="contextMenuVisible"
          class="context-menu"
          :style="{ top: contextMenuY + 'px', left: contextMenuX + 'px' }"
          @click="closeContextMenu"
        >
          <button class="context-menu-item" @click="handleShowDetail">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            查看详情
          </button>
          <button class="context-menu-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            重命名
          </button>
          <div class="context-menu-divider"></div>
          <button class="context-menu-item danger">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18"></path>
              <path
                d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
              ></path>
            </svg>
            删除
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, h } from 'vue'
import { useFileListStore } from '@renderer/stores/knowledge-library/file-list.store'
import { useFileSelectionStore } from '@renderer/stores/knowledge-library/file-selection.store'
import type { FileNode } from '../../types'

// ============ 子组件定义 ============

// 智能文件名截断组件（中间省略）
const SmartTruncateName = (props: { name: string }) => {
  const cutIndex = props.name.length - 7
  const head = props.name.length > 10 ? props.name.slice(0, Math.max(0, cutIndex)) : props.name
  const tail = props.name.length > 10 ? props.name.slice(cutIndex) : ''

  return h(
    'div',
    { class: 'smart-truncate-name', title: props.name },
    [
      h('span', { class: 'truncate-head' }, head),
      tail && h('span', { class: 'truncate-tail' }, tail)
    ]
  )
}

// 状态徽章组件
const StatusBadge = (props: { status?: string }) => {
  const statusConfig = {
    parsed: { label: '已解析', class: 'status-parsed', icon: '✓' },
    parsing: { label: '解析中', class: 'status-parsing', icon: '⟳' },
    failed: { label: '解析失败', class: 'status-failed', icon: '✕' },
    pending: { label: '待解析', class: 'status-pending', icon: '○' }
  }

  const config = props.status ? statusConfig[props.status] || statusConfig.pending : statusConfig.pending

  return h(
    'div',
    { class: ['status-badge', config.class] },
    [
      h('span', { class: 'status-icon' }, config.icon),
      h('span', { class: 'status-label' }, config.label)
    ]
  )
}

const props = defineProps<{
  knowledgeBaseId: number
  pageSize?: number
}>()

const emit = defineEmits<{
  (e: 'show-detail', file: FileNode): void
}>()

// 使用 Pinia Store
const fileListStore = useFileListStore()
const selectionStore = useFileSelectionStore()

// 选择模式
const isSelectionModeEnabled = computed(() => {
  return selectionStore.isSelectionModeEnabled(props.knowledgeBaseId)
})

// ============ 列宽调整功能 ============

interface Column {
  id: string
  label: string
  width: number
  minWidth: number
}

// 定义复选框列
const checkboxColumn: Column = { id: 'checkbox', label: '', width: 50, minWidth: 50 }

// 定义数据列
const dataColumns = ref<Column[]>([
  { id: 'name', label: '名称', width: 350, minWidth: 200 },
  { id: 'status', label: '状态', width: 140, minWidth: 120 },
  { id: 'size', label: '大小', width: 100, minWidth: 80 },
  { id: 'chunkCount', label: '分块数', width: 100, minWidth: 80 },
  { id: 'updateTime', label: '更新时间', width: 180, minWidth: 150 },
  { id: 'actions', label: '', width: 100, minWidth: 80 }
])

// 组合所有列（包含复选框列）
const columns = computed(() => {
  return isSelectionModeEnabled.value ? [checkboxColumn, ...dataColumns.value] : dataColumns.value
})

// 显示的列（不包含复选框列，用于渲染数据行）
const displayColumns = computed(() => dataColumns.value)

// 计算总宽度
const totalWidth = computed(() => {
  return columns.value.reduce((acc, col) => acc + col.width, 0)
})

// 拖拽状态
interface ResizerState {
  index: number
  startX: number
  startWidth: number
}

const activeResizer = ref<number | null>(null)
const resizerState = ref<ResizerState | null>(null)

const handleMouseDown = (event: MouseEvent, index: number) => {
  event.preventDefault()
  activeResizer.value = index
  resizerState.value = {
    index,
    startX: event.clientX,
    startWidth: dataColumns.value[index].width
  }
}

const handleMouseMove = (event: MouseEvent) => {
  if (!resizerState.value) return

  const deltaX = event.clientX - resizerState.value.startX
  const newWidth = Math.max(
    dataColumns.value[resizerState.value.index].minWidth,
    resizerState.value.startWidth + deltaX
  )

  dataColumns.value[resizerState.value.index].width = newWidth
}

const handleMouseUp = () => {
  activeResizer.value = null
  resizerState.value = null
  document.body.style.cursor = ''
}

// 监听全局鼠标事件
watch(activeResizer, (newValue) => {
  if (newValue !== null) {
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  } else {
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  }
})

// 获取文件图标
const getFileIcon = (extension?: string) => {
  // 返回一个简单的文档图标组件
  return () =>
    h(
      'svg',
      {
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: '2',
        class: 'file-icon-svg'
      },
      [
        h('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
        h('polyline', { points: '14,2 14,8 20,8' })
      ]
    )
}

// Watch pageSize changes from parent and update store
watch(
  () => props.pageSize,
  (newSize) => {
    if (newSize) {
      fileListStore.setPageSize(newSize)
    }
  },
  { immediate: true }
)

// 从 Store 获取数据
const paginatedFiles = computed(() => fileListStore.paginatedFiles)
const totalFiles = computed(() => fileListStore.totalFiles)
const totalPages = computed(() => fileListStore.totalPages)
const startIndex = computed(() => fileListStore.startIndex)
const endIndex = computed(() => fileListStore.endIndex)
const currentPage = computed(() => fileListStore.currentPage)
const loading = computed(() => fileListStore.loading)

// Visible page numbers (show max 7 pages)
const visiblePages = computed(() => {
  const pages: number[] = []
  const maxVisible = 7
  let start = Math.max(1, currentPage.value - Math.floor(maxVisible / 2))
  let end = Math.min(totalPages.value, start + maxVisible - 1)

  // Adjust start if we're near the end
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1)
  }

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  return pages
})

const goToPage = (page: number) => {
  fileListStore.goToPage(page)
  // Scroll to top of table
  const container = document.querySelector('.KnowledgeView_KnowledgeDetail_content_scrollable')
  if (container) {
    container.scrollTop = 0
  }
}

// 初始化时获取文件列表
onMounted(async () => {
  await fileListStore.fetchFiles(props.knowledgeBaseId)
})

// 监听 knowledgeBaseId 变化，重新加载数据
watch(
  () => props.knowledgeBaseId,
  async (newId) => {
    if (newId) {
      await fileListStore.fetchFiles(newId)
    }
  }
)

const getStatusText = (status?: string) => {
  const statusMap = {
    parsed: '已解析',
    parsing: '解析中',
    failed: '解析失败',
    pending: '待解析'
  }
  return status ? statusMap[status] || '未知' : '未知'
}

const formatUpdateTime = (time?: string) => {
  if (!time) return '-'
  try {
    const date = new Date(time)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return time
  }
}

// Context Menu
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuFile = ref<FileNode | null>(null)

const handleContextMenu = (event: MouseEvent, file: FileNode) => {
  contextMenuFile.value = file
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuVisible.value = true
}

const closeContextMenu = () => {
  contextMenuVisible.value = false
  contextMenuFile.value = null
}

const handleShowDetail = () => {
  if (contextMenuFile.value) {
    emit('show-detail', contextMenuFile.value)
  }
  closeContextMenu()
}

// Close context menu on outside click
onMounted(() => {
  document.addEventListener('click', closeContextMenu)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeContextMenu)
})

// 选择相关功能
const isFileSelected = (fileId: string | number): boolean => {
  return selectionStore.isSelected(props.knowledgeBaseId, fileId)
}

const handleToggleSelection = (fileId: string | number): void => {
  selectionStore.toggleSelection(props.knowledgeBaseId, fileId)
}

const isAllSelected = computed(() => {
  const allFileIds = fileListStore.files.map((f) => f.id)
  return selectionStore.isAllSelected(props.knowledgeBaseId, allFileIds)
})

const isIndeterminate = computed(() => {
  const allFileIds = fileListStore.files.map((f) => f.id)
  const selectedCount = selectionStore.getSelectedCount(props.knowledgeBaseId)
  return selectedCount > 0 && selectedCount < allFileIds.length
})

const handleSelectAll = (event: Event): void => {
  const target = event.target as HTMLInputElement
  const allFileIds = fileListStore.files.map((f) => f.id)

  if (target.checked) {
    selectionStore.selectAll(props.knowledgeBaseId, allFileIds)
  } else {
    selectionStore.deselectAll(props.knowledgeBaseId)
  }
}
</script>

<style scoped>
/* ============ 主容器 ============ */
.file-list-container {
  padding: 0 2rem 2rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ============ 表格容器 ============ */
.table-wrapper {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  overflow-x: auto;
  overflow-y: hidden;
}

/* 自定义滚动条 */
.table-wrapper::-webkit-scrollbar {
  height: 8px;
}

.table-wrapper::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 0 0 0.75rem 0.75rem;
}

.table-wrapper::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.table-wrapper::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.table-content {
  min-width: 100%;
  display: flex;
  flex-direction: column;
}

/* ============ 表头 ============ */
.table-header {
  display: flex;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 10;
  user-select: none;
}

.header-cell {
  display: flex;
  align-items: center;
  padding: 0.875rem 1rem;
  position: relative;
  transition: background 150ms;
}

.header-cell:hover {
  background: #f1f5f9;
}

.header-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
}

/* 拖拽调整手柄 */
.resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 16px;
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  transition: background 150ms;
}

.resize-handle:hover,
.resize-handle.active {
  background: rgba(59, 130, 246, 0.1);
}

.resize-line {
  width: 1px;
  height: 16px;
  background: #cbd5e1;
  transition: background 150ms;
}

.resize-handle:hover .resize-line,
.resize-handle.active .resize-line {
  background: #3b82f6;
}

/* ============ 表格主体 ============ */
.table-body {
  background: white;
}

.table-row {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #f1f5f9;
  transition: background 150ms;
  min-height: 3.5rem;
}

.table-row:hover {
  background: #f8fafc;
}

.table-row:last-child {
  border-bottom: none;
}

.table-cell {
  display: flex;
  align-items: center;
  padding: 0.875rem 1rem;
  font-size: 0.875rem;
  color: #334155;
  min-height: 3.5rem;
  box-sizing: border-box;
}

.text-secondary {
  color: #64748b;
}

/* ============ 文件名列 ============ */
.name-cell {
  gap: 0.75rem;
  font-weight: 500;
  color: #0f172a;
  min-width: 0;
}

.file-icon-wrapper {
  flex-shrink: 0;
  padding: 0.5rem;
  background: #f1f5f9;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-icon-svg {
  width: 1.25rem;
  height: 1.25rem;
  color: #64748b;
}

/* 智能截断组件 */
.smart-truncate-name {
  display: flex;
  align-items: center;
  min-width: 0;
  width: 100%;
}

.truncate-head {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #0f172a;
  font-weight: 500;
}

.truncate-tail {
  flex-shrink: 0;
  color: #0f172a;
  font-weight: 500;
}

/* ============ 状态徽章 ============ */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid;
  border-color: currentColor;
  border-opacity: 0.2;
}

.status-icon {
  font-size: 0.875rem;
  line-height: 1;
}

.status-label {
  line-height: 1;
}

.status-parsed {
  background: #ecfdf5;
  color: #059669;
  border-color: #059669;
}

.status-parsing {
  background: #fef3c7;
  color: #d97706;
  border-color: #d97706;
}

.status-parsing .status-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.status-failed {
  background: #fee2e2;
  color: #dc2626;
  border-color: #dc2626;
}

.status-pending {
  background: #f1f5f9;
  color: #64748b;
  border-color: #94a3b8;
}

/* ============ 空状态 ============ */
.empty-state {
  justify-content: center;
  padding: 3rem 0;
  border-bottom: none;
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  color: #94a3b8;
}

.empty-icon {
  width: 3rem;
  height: 3rem;
  stroke-width: 1.5;
}

.loading-icon {
  width: 2rem;
  height: 2rem;
  stroke-width: 2;
  animation: spin 1s linear infinite;
}

/* ============ 复选框 ============ */
.checkbox-col {
  justify-content: center;
}

.checkbox-cell {
  justify-content: center;
  padding: 0.875rem 0.5rem;
}

.checkbox-input {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
  accent-color: #4f46e5;
}

.checkbox-input:indeterminate {
  accent-color: #6366f1;
}

/* ============ 操作按钮 ============ */
.action-cell {
  justify-content: flex-end;
}

.action-buttons {
  display: flex;
  gap: 0.375rem;
  opacity: 0;
  transition: opacity 200ms;
}

.table-row:hover .action-buttons {
  opacity: 1;
}

.action-btn {
  padding: 0.375rem;
  color: #94a3b8;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms;
}

.action-btn:hover {
  background: #e2e8f0;
  color: #475569;
}

.action-btn.delete:hover {
  background: #fee2e2;
  color: #ef4444;
}

.action-btn svg {
  width: 1.125rem;
  height: 1.125rem;
}

/* ============ Pagination ============ */
.KnowledgeView_KnowledgeDetail_Views_FileListView_pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 0;
  margin-top: 1rem;
  border-top: 1px solid #f1f5f9;
}

.KnowledgeView_KnowledgeDetail_Views_FileListView_paginationInfo {
  font-size: 0.875rem;
  color: #64748b;
}

.KnowledgeView_KnowledgeDetail_Views_FileListView_paginationControls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.KnowledgeView_KnowledgeDetail_Views_FileListView_paginationBtn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  background: white;
  color: #475569;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms;
}

.KnowledgeView_KnowledgeDetail_Views_FileListView_paginationBtn:hover:not(:disabled) {
  border-color: #cbd5e1;
  background: #f8fafc;
  color: #0f172a;
}

.KnowledgeView_KnowledgeDetail_Views_FileListView_paginationBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.KnowledgeView_KnowledgeDetail_Views_FileListView_paginationBtn svg {
  width: 1rem;
  height: 1rem;
}

.KnowledgeView_KnowledgeDetail_Views_FileListView_pageNumbers {
  display: flex;
  gap: 0.25rem;
}

.KnowledgeView_KnowledgeDetail_Views_FileListView_pageBtn {
  min-width: 2.25rem;
  height: 2.25rem;
  padding: 0 0.5rem;
  border: 1px solid #e2e8f0;
  background: white;
  color: #475569;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms;
  display: flex;
  align-items: center;
  justify-content: center;
}

.KnowledgeView_KnowledgeDetail_Views_FileListView_pageBtn:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
  color: #0f172a;
}

.KnowledgeView_KnowledgeDetail_Views_FileListView_pageBtn.active {
  background: #0f172a;
  color: white;
  border-color: #0f172a;
}

.KnowledgeView_KnowledgeDetail_Views_FileListView_pageBtn.active:hover {
  background: #1e293b;
  border-color: #1e293b;
}

/* Context Menu */
.context-menu {
  position: fixed;
  background: white;
  border-radius: 0.5rem;
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  padding: 0.25rem;
  min-width: 180px;
  z-index: 2000;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: none;
  background: transparent;
  color: #334155;
  font-size: 0.875rem;
  text-align: left;
  cursor: pointer;
  border-radius: 0.375rem;
  transition: all 150ms;
}

.context-menu-item:hover {
  background: #f8fafc;
}

.context-menu-item.danger {
  color: #dc2626;
}

.context-menu-item.danger:hover {
  background: #fef2f2;
}

.context-menu-item svg {
  width: 1rem;
  height: 1rem;
}

.context-menu-divider {
  height: 1px;
  background: #f1f5f9;
  margin: 0.25rem 0;
}

.context-fade-enter-active,
.context-fade-leave-active {
  transition: opacity 150ms ease;
}

.context-fade-enter-from,
.context-fade-leave-to {
  opacity: 0;
}

/* Checkbox styles */
.checkbox-col {
  width: 50px;
  text-align: center;
}

.checkbox-cell {
  text-align: center;
  padding: 0.875rem 0.5rem;
  overflow: visible !important;
}

.checkbox-input {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
  accent-color: #4f46e5;
}

/* 操作列样式调整 */
.action-cell {
  overflow: visible !important;
}
</style>

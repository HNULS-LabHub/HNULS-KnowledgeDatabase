<template>
  <div class="KnowledgeView_KnowledgeDetail_Views_FileListView_container">
    <table class="KnowledgeView_KnowledgeDetail_Views_FileListView_table">
      <thead>
        <tr>
          <th class="KnowledgeView_KnowledgeDetail_Views_FileListView_th name-col">名称</th>
          <th class="KnowledgeView_KnowledgeDetail_Views_FileListView_th">状态</th>
          <th class="KnowledgeView_KnowledgeDetail_Views_FileListView_th">大小</th>
          <th class="KnowledgeView_KnowledgeDetail_Views_FileListView_th">分块数</th>
          <th class="KnowledgeView_KnowledgeDetail_Views_FileListView_th">更新时间</th>
          <th class="KnowledgeView_KnowledgeDetail_Views_FileListView_th action-col"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading" class="KnowledgeView_KnowledgeDetail_Views_FileListView_tr">
          <td colspan="6" style="text-align: center; padding: 2rem; color: #94a3b8">加载中...</td>
        </tr>
        <tr
          v-else-if="paginatedFiles.length === 0"
          class="KnowledgeView_KnowledgeDetail_Views_FileListView_tr"
        >
          <td colspan="6" style="text-align: center; padding: 2rem; color: #94a3b8">暂无文件</td>
        </tr>
        <tr
          v-else
          v-for="file in paginatedFiles"
          :key="file.id"
          class="KnowledgeView_KnowledgeDetail_Views_FileListView_tr"
          @contextmenu.prevent="handleContextMenu($event, file)"
        >
          <td class="KnowledgeView_KnowledgeDetail_Views_FileListView_td name-cell">
            <div class="file-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
              </svg>
            </div>
            <span class="file-name">{{ file.name }}</span>
          </td>
          <td class="KnowledgeView_KnowledgeDetail_Views_FileListView_td">
            <span class="status-badge" :class="file.status">
              {{ getStatusText(file.status) }}
            </span>
          </td>
          <td class="KnowledgeView_KnowledgeDetail_Views_FileListView_td">
            {{ file.size || '-' }}
          </td>
          <td class="KnowledgeView_KnowledgeDetail_Views_FileListView_td">
            {{ file.chunkCount || '-' }}
          </td>
          <td class="KnowledgeView_KnowledgeDetail_Views_FileListView_td">
            {{ formatUpdateTime(file.updateTime) }}
          </td>
          <td class="KnowledgeView_KnowledgeDetail_Views_FileListView_td action-cell">
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
                  <path
                    d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                  ></path>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

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
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useFileListStore } from '@renderer/stores/knowledge-library/file-list.store'
import type { FileNode } from '../../types'

const props = defineProps<{
  knowledgeBaseId: number
  pageSize?: number
}>()

const emit = defineEmits<{
  (e: 'show-detail', file: FileNode): void
}>()

// 使用 Pinia Store
const fileListStore = useFileListStore()

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
</script>

<style scoped>
.KnowledgeView_KnowledgeDetail_Views_FileListView_container {
  padding: 0 2rem 2rem 2rem;
}

.KnowledgeView_KnowledgeDetail_Views_FileListView_table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.KnowledgeView_KnowledgeDetail_Views_FileListView_th {
  text-align: left;
  padding: 1rem;
  color: #64748b;
  font-weight: 500;
  border-bottom: 1px solid #e2e8f0;
  background: rgba(255, 255, 255, 0.9);
  position: sticky;
  top: 0;
  z-index: 5;
  backdrop-filter: blur(8px);
}

.KnowledgeView_KnowledgeDetail_Views_FileListView_tr {
  transition: background 150ms;
  border-bottom: 1px solid #f1f5f9;
}

.KnowledgeView_KnowledgeDetail_Views_FileListView_tr:hover {
  background: #f8fafc;
}

.KnowledgeView_KnowledgeDetail_Views_FileListView_td {
  padding: 0.875rem 1rem;
  color: #334155;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 500;
  color: #0f172a;
}

.file-icon {
  color: #94a3b8;
  display: flex;
  align-items: center;
}

.file-icon svg {
  width: 1.25rem;
  height: 1.25rem;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.parsed {
  background: #ecfdf5;
  color: #059669;
}

.status-badge.parsing {
  background: #fef3c7;
  color: #d97706;
}

.status-badge.failed {
  background: #fee2e2;
  color: #dc2626;
}

.status-badge.pending {
  background: #f1f5f9;
  color: #64748b;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  opacity: 0;
  transition: opacity 200ms;
}

.KnowledgeView_KnowledgeDetail_Views_FileListView_tr:hover .action-buttons {
  opacity: 1;
}

.action-btn {
  padding: 0.25rem;
  color: #94a3b8;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
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
  width: 1rem;
  height: 1rem;
}

/* Pagination */
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
</style>

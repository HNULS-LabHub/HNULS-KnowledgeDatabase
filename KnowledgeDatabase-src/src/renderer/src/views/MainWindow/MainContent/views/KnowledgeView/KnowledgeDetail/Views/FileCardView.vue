<template>
  <div class="KnowledgeView_KnowledgeDetail_Views_FileCardView_container">
    <div
      v-for="file in mockFiles"
      :key="file.id"
      class="KnowledgeView_KnowledgeDetail_Views_FileCardView_card"
      @contextmenu.prevent="handleContextMenu($event, file)"
    >
      <div class="KnowledgeView_KnowledgeDetail_Views_FileCardView_icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14,2 14,8 20,8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      </div>
      <div class="KnowledgeView_KnowledgeDetail_Views_FileCardView_content">
        <h3 class="KnowledgeView_KnowledgeDetail_Views_FileCardView_title">{{ file.name }}</h3>
        <div class="KnowledgeView_KnowledgeDetail_Views_FileCardView_meta">
          <span>{{ file.size }}</span>
          <span>•</span>
          <span>{{ file.updateTime }}</span>
        </div>
      </div>
      <div class="KnowledgeView_KnowledgeDetail_Views_FileCardView_footer">
        <div class="KnowledgeView_KnowledgeDetail_Views_FileCardView_status">
          <span class="status-dot" :class="file.status"></span>
          {{ getStatusText(file.status) }}
        </div>
        <button
          class="KnowledgeView_KnowledgeDetail_Views_FileCardView_moreBtn"
          @click="$emit('show-detail', file)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="19" cy="12" r="1"></circle>
            <circle cx="5" cy="12" r="1"></circle>
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
import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { FileNode } from '../../types'

const emit = defineEmits<{
  (e: 'show-detail', file: FileNode): void
}>()

// Mock data (same as FileListView)
const mockFiles = ref<FileNode[]>([
  {
    id: 1,
    name: '技术架构说明书-V1.0.pdf',
    type: 'file',
    size: '2.4 MB',
    updateTime: '2024-03-21',
    status: 'parsed',
    chunkCount: 128
  },
  {
    id: 2,
    name: '产品需求文档-V2.0.pdf',
    type: 'file',
    size: '1.8 MB',
    updateTime: '2024-03-21',
    status: 'parsed',
    chunkCount: 96
  }
])

for (let i = 3; i <= 12; i++) {
  mockFiles.value.push({
    id: i,
    name: `文档-${i}.pdf`,
    type: 'file',
    size: `${(Math.random() * 5 + 0.5).toFixed(1)} MB`,
    updateTime: '2024-03-20',
    status: i % 4 === 0 ? 'failed' : 'parsed',
    chunkCount: Math.floor(Math.random() * 200 + 50)
  })
}

const getStatusText = (status?: string) => {
  const statusMap = {
    parsed: '已解析',
    parsing: '解析中',
    failed: '解析失败',
    pending: '待解析'
  }
  return status ? statusMap[status] || '未知' : '未知'
}

// Context Menu (same logic as FileListView)
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

onMounted(() => {
  document.addEventListener('click', closeContextMenu)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeContextMenu)
})
</script>

<style scoped>
.KnowledgeView_KnowledgeDetail_Views_FileCardView_container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.5rem;
  padding: 1.5rem 2rem;
}

.KnowledgeView_KnowledgeDetail_Views_FileCardView_card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  overflow: hidden;
  transition: all 200ms;
  display: flex;
  flex-direction: column;
  cursor: pointer;
}

.KnowledgeView_KnowledgeDetail_Views_FileCardView_card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
  border-color: #cbd5e1;
}

.KnowledgeView_KnowledgeDetail_Views_FileCardView_icon {
  height: 80px;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  border-bottom: 1px solid #f1f5f9;
}

.KnowledgeView_KnowledgeDetail_Views_FileCardView_icon svg {
  width: 2.5rem;
  height: 2.5rem;
}

.KnowledgeView_KnowledgeDetail_Views_FileCardView_content {
  padding: 1rem;
  flex: 1;
}

.KnowledgeView_KnowledgeDetail_Views_FileCardView_title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 0.5rem 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}

.KnowledgeView_KnowledgeDetail_Views_FileCardView_meta {
  font-size: 0.75rem;
  color: #94a3b8;
  display: flex;
  gap: 0.5rem;
}

.KnowledgeView_KnowledgeDetail_Views_FileCardView_footer {
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border-top: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.KnowledgeView_KnowledgeDetail_Views_FileCardView_status {
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-weight: 500;
  color: #334155;
}

.status-dot {
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 50%;
}

.status-dot.parsed {
  background: #10b981;
}

.status-dot.parsing {
  background: #f59e0b;
}

.status-dot.failed {
  background: #ef4444;
}

.status-dot.pending {
  background: #94a3b8;
}

.KnowledgeView_KnowledgeDetail_Views_FileCardView_moreBtn {
  padding: 0.25rem;
  color: #94a3b8;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 0.25rem;
  display: flex;
  align-items: center;
  transition: all 200ms;
}

.KnowledgeView_KnowledgeDetail_Views_FileCardView_moreBtn:hover {
  background: #e2e8f0;
  color: #475569;
}

.KnowledgeView_KnowledgeDetail_Views_FileCardView_moreBtn svg {
  width: 1rem;
  height: 1rem;
}

/* Context Menu (same styles as FileListView) */
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

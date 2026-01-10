<template>
  <div class="KnowledgeView_KnowledgeDetail_Views_FileTreeView_container">
    <!-- 模拟树形结构 -->
    <div v-for="folder in mockFolders" :key="folder.id" class="tree-group">
      <div
        class="tree-item folder"
        @click="toggleFolder(folder.id)"
        @contextmenu.prevent="handleContextMenu($event, folder)"
      >
        <span class="toggle-icon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="chevron"
            :class="{ expanded: expandedFolders.has(folder.id) }"
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </span>
        <span class="icon folder-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path
              d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
            ></path>
          </svg>
        </span>
        <span class="label">{{ folder.name }}</span>
        <span class="meta">{{ folder.children?.length || 0 }} 项</span>
      </div>

      <div class="tree-children" v-if="expandedFolders.has(folder.id)">
        <div
          v-for="file in folder.children"
          :key="file.id"
          class="tree-item file"
          @contextmenu.prevent="handleContextMenu($event, file)"
        >
          <span class="indent"></span>
          <span class="icon file-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
            </svg>
          </span>
          <span class="label">{{ file.name }}</span>
          <span class="meta-right">{{ file.size }} • {{ file.updateTime }}</span>

          <div class="tree-actions">
            <button class="action-btn" @click.stop="$emit('show-detail', file)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="19" cy="12" r="1"></circle>
                <circle cx="5" cy="12" r="1"></circle>
              </svg>
            </button>
          </div>
        </div>
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
          <button
            v-if="contextMenuNode?.type === 'file'"
            class="context-menu-item"
            @click="handleShowDetail"
          >
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

defineEmits<{
  (e: 'show-detail', file: FileNode): void
}>()

interface FolderNode extends FileNode {
  children?: FileNode[]
}

const expandedFolders = ref<Set<string | number>>(new Set([1, 2]))

// Mock data with folders
const mockFolders = ref<FolderNode[]>([
  {
    id: 1,
    name: '项目文档目录',
    type: 'folder',
    children: [
      {
        id: '1-1',
        name: '需求规格说明书-1-1.pdf',
        type: 'file',
        size: '2.4 MB',
        updateTime: '2024-03-21',
        status: 'parsed',
        chunkCount: 128
      },
      {
        id: '1-2',
        name: '需求规格说明书-1-2.pdf',
        type: 'file',
        size: '1.8 MB',
        updateTime: '2024-03-20',
        status: 'parsed',
        chunkCount: 96
      },
      {
        id: '1-3',
        name: '需求规格说明书-1-3.pdf',
        type: 'file',
        size: '3.2 MB',
        updateTime: '2024-03-19',
        status: 'parsing',
        chunkCount: 0
      }
    ]
  },
  {
    id: 2,
    name: '技术文档',
    type: 'folder',
    children: [
      {
        id: '2-1',
        name: 'API文档.pdf',
        type: 'file',
        size: '5.1 MB',
        updateTime: '2024-03-18',
        status: 'parsed',
        chunkCount: 256
      },
      {
        id: '2-2',
        name: '架构设计.pdf',
        type: 'file',
        size: '4.3 MB',
        updateTime: '2024-03-17',
        status: 'failed',
        chunkCount: 0
      }
    ]
  },
  {
    id: 3,
    name: '用户手册',
    type: 'folder',
    children: [
      {
        id: '3-1',
        name: '用户指南V1.0.pdf',
        type: 'file',
        size: '1.5 MB',
        updateTime: '2024-03-16',
        status: 'parsed',
        chunkCount: 64
      }
    ]
  }
])

const toggleFolder = (id: string | number) => {
  if (expandedFolders.value.has(id)) {
    expandedFolders.value.delete(id)
  } else {
    expandedFolders.value.add(id)
  }
}

// Context Menu
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuNode = ref<FileNode | null>(null)

const handleContextMenu = (event: MouseEvent, node: FileNode) => {
  contextMenuNode.value = node
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuVisible.value = true
}

const closeContextMenu = () => {
  contextMenuVisible.value = false
  contextMenuNode.value = null
}

const handleShowDetail = () => {
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
.KnowledgeView_KnowledgeDetail_Views_FileTreeView_container {
  padding: 1rem 2rem;
}

.tree-item {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 150ms;
  gap: 0.5rem;
  color: #334155;
}

.tree-item:hover {
  background: #f1f5f9;
}

.tree-item.folder {
  font-weight: 500;
  color: #0f172a;
}

.toggle-icon {
  display: flex;
  align-items: center;
  color: #94a3b8;
  width: 1rem;
  justify-content: center;
}

.toggle-icon .chevron {
  width: 1rem;
  height: 1rem;
  transition: transform 200ms;
  transform: rotate(0deg);
}

.toggle-icon .chevron.expanded {
  transform: rotate(90deg);
}

.icon {
  display: flex;
  align-items: center;
  color: #94a3b8;
}

.folder-icon {
  color: #3b82f6;
}

.icon svg {
  width: 1.125rem;
  height: 1.125rem;
}

.label {
  flex: 1;
  font-size: 0.875rem;
}

.meta {
  font-size: 0.75rem;
  color: #94a3b8;
}

.tree-children {
  padding-left: 1rem;
  margin-left: 0.5rem;
  border-left: 1px solid #e2e8f0;
}

.indent {
  width: 1.5rem;
}

.meta-right {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-right: 1rem;
}

.tree-actions {
  opacity: 0;
  transition: opacity 200ms;
}

.tree-item:hover .tree-actions {
  opacity: 1;
}

.action-btn {
  padding: 0.25rem;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #94a3b8;
  border-radius: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  background: #e2e8f0;
  color: #475569;
}

.action-btn svg {
  width: 1rem;
  height: 1rem;
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

<template>
  <div class="tree-group">
    <div
      v-if="node.type === 'folder'"
      class="tree-item folder"
      @click="$emit('toggle-folder', node.id)"
      @contextmenu.prevent="handleContextMenu($event, node)"
    >
      <span class="toggle-icon">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="chevron"
          :class="{ expanded: expandedFolders.has(node.id) }"
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
      <span class="label">{{ node.name }}</span>
      <span class="meta">{{ node.children?.length || 0 }} 项</span>
    </div>

    <div
      v-else
      class="tree-item file"
      :style="{ paddingLeft: `${(node.level || 0) * 1.5 + 0.75}rem` }"
      @contextmenu.prevent="handleContextMenu($event, node)"
    >
      <span class="icon file-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14,2 14,8 20,8"></polyline>
        </svg>
      </span>
      <span class="label">{{ node.name }}</span>
      <span class="meta-right">{{ node.size || '-' }} • {{ formatUpdateTime(node.updateTime) }}</span>

      <div class="tree-actions">
        <button class="action-btn" @click.stop="$emit('show-detail', node)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="19" cy="12" r="1"></circle>
            <circle cx="5" cy="12" r="1"></circle>
          </svg>
        </button>
      </div>
    </div>

    <div v-if="node.type === 'folder' && expandedFolders.has(node.id) && node.children" class="tree-children">
      <TreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :expanded-folders="expandedFolders"
        @toggle-folder="$emit('toggle-folder', $event)"
        @show-detail="$emit('show-detail', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { TreeNode, FileNode } from '@renderer/stores/knowledge-library/file.types'

const props = defineProps<{
  node: TreeNode
  expandedFolders: Set<string | number>
}>()

defineEmits<{
  (e: 'toggle-folder', id: string | number): void
  (e: 'show-detail', file: FileNode): void
}>()

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
  if (contextMenuNode.value) {
    // Emit handled in parent
    closeContextMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', closeContextMenu)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeContextMenu)
})
</script>

<style scoped>
.tree-group {
  width: 100%;
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
</style>

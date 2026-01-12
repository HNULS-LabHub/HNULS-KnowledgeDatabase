<template>
  <div class="tree-group">
    <div
      v-if="node.type === 'folder'"
      class="tree-item folder"
      :class="{
        dragging: isDragging,
        'drag-over': dragOverState === 'valid',
        'drag-over-invalid': dragOverState === 'invalid'
      }"
      draggable="true"
      @click="$emit('toggle-folder', node.id)"
      @contextmenu.prevent="handleContextMenu($event, node)"
      @dragstart="handleDragStart($event, node)"
      @dragover.prevent="handleDragOver($event, node)"
      @dragenter.prevent="handleDragEnter($event, node)"
      @dragleave="handleDragLeave($event)"
      @drop.prevent="handleDrop($event, node)"
      @dragend="handleDragEnd"
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
      :class="{
        dragging: isDragging
      }"
      :style="{ paddingLeft: `${(node.level || 0) * 1.5 + 0.75}rem` }"
      draggable="true"
      @contextmenu.prevent="handleContextMenu($event, node)"
      @dragstart="handleDragStart($event, node)"
      @dragend="handleDragEnd"
    >
      <span class="icon file-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14,2 14,8 20,8"></polyline>
        </svg>
      </span>
      <span class="label">{{ node.name }}</span>
      <span class="meta-right"
        >{{ node.size || '-' }} • {{ formatUpdateTime(node.updateTime) }}</span
      >

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

    <div
      v-if="node.type === 'folder' && expandedFolders.has(node.id) && node.children"
      class="tree-children"
    >
      <TreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :expanded-folders="expandedFolders"
        :knowledge-base-id="knowledgeBaseId"
        @toggle-folder="$emit('toggle-folder', $event)"
        @show-detail="$emit('show-detail', $event)"
        @node-moved="$emit('node-moved')"
        @external-drop="$emit('external-drop', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useFileTreeStore } from '@renderer/stores/knowledge-library/file-tree.store'
import type { TreeNode, FileNode } from '@renderer/stores/knowledge-library/file.types'

const props = defineProps<{
  node: TreeNode
  expandedFolders: Set<string | number>
  knowledgeBaseId?: number
}>()

const emit = defineEmits<{
  (e: 'toggle-folder', id: string | number): void
  (e: 'show-detail', file: FileNode): void
  (e: 'node-moved'): void
  (e: 'external-drop', data: { targetPath: string; targetNode: TreeNode }): void
}>()

const fileTreeStore = useFileTreeStore()

// 拖拽状态
const isDragging = ref(false)
const dragOverState = ref<'none' | 'valid' | 'invalid'>('none')
const draggedNode = ref<TreeNode | null>(null)
// 缓存的拖拽源路径（用于跨组件实例的拖拽）
const currentDragSourcePath = ref<string | null>(null)

const formatUpdateTime = (time?: string): string => {
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

const handleContextMenu = (event: MouseEvent, node: FileNode): void => {
  contextMenuNode.value = node
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuVisible.value = true
}

const closeContextMenu = (): void => {
  contextMenuVisible.value = false
  contextMenuNode.value = null
}

onMounted(() => {
  document.addEventListener('click', closeContextMenu)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeContextMenu)
})

// 拖拽处理函数
const handleDragStart = (event: DragEvent, node: TreeNode): void => {
  if (!event.dataTransfer) return

  // 阻止事件冒泡，避免影响父节点
  event.stopPropagation()

  isDragging.value = true
  draggedNode.value = node

  // 设置拖拽数据
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData(
    'application/x-tree-node',
    JSON.stringify({
      id: node.id,
      path: node.path || '',
      type: node.type,
      name: node.name
    })
  )

  // 设置拖拽图标
  if (event.dataTransfer.setDragImage && event.target instanceof HTMLElement) {
    const dragImage = event.target.cloneNode(true) as HTMLElement
    dragImage.style.opacity = '0.5'
    dragImage.style.position = 'absolute'
    dragImage.style.top = '-1000px'
    document.body.appendChild(dragImage)
    event.dataTransfer.setDragImage(dragImage, 0, 0)
    setTimeout(() => document.body.removeChild(dragImage), 0)
  }
}

const handleDragOver = (event: DragEvent, targetNode: TreeNode): void => {
  // 阻止事件冒泡，避免与 DropZone 冲突
  event.stopPropagation()

  // 只有文件夹节点才能作为拖拽目标
  if (targetNode.type !== 'folder') {
    dragOverState.value = 'none'
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'none'
    }
    return
  }

  if (!event.dataTransfer) {
    dragOverState.value = 'none'
    return
  }

  // 检查是否是内部拖拽（通过检查 dataTransfer.types）
  const isInternalDrag = event.dataTransfer.types.includes('application/x-tree-node')

  if (isInternalDrag) {
    // 内部拖拽：使用缓存的源路径或本地 draggedNode
    const sourcePath = currentDragSourcePath.value || draggedNode.value?.path

    if (sourcePath) {
      const validation = fileTreeStore.validateMove(sourcePath, targetNode.path || '')

      if (validation.valid) {
        dragOverState.value = 'valid'
        event.dataTransfer.dropEffect = 'move'
      } else {
        dragOverState.value = 'invalid'
        event.dataTransfer.dropEffect = 'none'
      }
    } else {
      // 无法获取源路径，默认允许（在 drop 时会再次验证）
      dragOverState.value = 'valid'
      event.dataTransfer.dropEffect = 'move'
    }
  } else if (event.dataTransfer.types.includes('Files')) {
    // 外部文件拖拽
    dragOverState.value = 'valid'
    event.dataTransfer.dropEffect = 'copy'
  } else {
    dragOverState.value = 'none'
  }
}

const handleDragEnter = (event: DragEvent, targetNode: TreeNode): void => {
  // 阻止事件冒泡，避免与 DropZone 冲突
  event.stopPropagation()

  // 在 dragenter 时尝试获取拖拽数据（此时可以获取）
  if (event.dataTransfer?.types.includes('application/x-tree-node')) {
    try {
      const dragData = event.dataTransfer.getData('application/x-tree-node')
      if (dragData) {
        const sourceNodeData = JSON.parse(dragData)
        currentDragSourcePath.value = sourceNodeData.path || null
      } else {
        currentDragSourcePath.value = null
      }
    } catch {
      currentDragSourcePath.value = null
    }
  } else {
    currentDragSourcePath.value = null
  }

  handleDragOver(event, targetNode)
}

const handleDragLeave = (event: DragEvent): void => {
  // 阻止事件冒泡
  event.stopPropagation()

  // 只有当真正离开元素时才清除状态
  const relatedTarget = event.relatedTarget as HTMLElement | null
  const currentTarget = event.currentTarget as HTMLElement | null
  if (!relatedTarget || !currentTarget?.contains(relatedTarget)) {
    dragOverState.value = 'none'
    // 清除缓存的源路径（如果离开的是文件夹节点）
    if (currentTarget?.classList.contains('folder')) {
      currentDragSourcePath.value = null
    }
  }
}

const handleDrop = async (event: DragEvent, targetNode: TreeNode): Promise<void> => {
  // 阻止事件冒泡，避免与 DropZone 冲突
  event.stopPropagation()

  dragOverState.value = 'none'

  if (!props.knowledgeBaseId) {
    console.warn('[TreeNode] Knowledge base ID not provided')
    return
  }

  // 检查是否是外部文件拖拽
  if (event.dataTransfer?.types.includes('Files')) {
    // 外部文件拖拽 - 触发父组件处理，传递目标目录信息
    if (targetNode.type === 'folder') {
      emit('external-drop', {
        targetPath: targetNode.path || '',
        targetNode
      })
    }
    return
  }

  // 内部节点拖拽
  const dragData = event.dataTransfer?.getData('application/x-tree-node')
  if (!dragData) return

  try {
    const sourceNodeData = JSON.parse(dragData)
    const sourcePath = sourceNodeData.path

    if (!sourcePath) {
      console.warn('[TreeNode] Source path not found')
      return
    }

    // 确定目标路径
    let targetPath = ''
    if (targetNode.type === 'folder') {
      targetPath = targetNode.path || ''
    }

    // 执行移动
    const result = await fileTreeStore.moveNode(
      props.knowledgeBaseId,
      sourcePath,
      targetPath,
      'rename'
    )

    if (result.success) {
      emit('node-moved')
    } else {
      console.error('[TreeNode] Move failed:', result.error)
      // TODO: 显示错误提示
    }
  } catch (error) {
    console.error('[TreeNode] Failed to handle drop:', error)
  }
}

const handleDragEnd = (): void => {
  isDragging.value = false
  dragOverState.value = 'none'
  draggedNode.value = null
  currentDragSourcePath.value = null
}
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
  border: 2px solid transparent;
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

/* 拖拽样式 */
.tree-item.dragging {
  opacity: 0.5;
  cursor: grabbing;
}

.tree-item.drag-over {
  background-color: rgba(59, 130, 246, 0.15);
  border: 2px dashed #3b82f6 !important;
  border-radius: 0.5rem;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.tree-item.drag-over-invalid {
  background-color: rgba(239, 68, 68, 0.15);
  border: 2px dashed #ef4444 !important;
  border-radius: 0.5rem;
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.1);
}
</style>

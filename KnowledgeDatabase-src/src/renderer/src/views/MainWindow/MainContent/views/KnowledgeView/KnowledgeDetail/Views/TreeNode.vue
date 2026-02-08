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
      <div v-if="isSelectionModeEnabled" class="checkbox-wrapper" @click.stop="handleCheckboxClick">
        <input
          type="checkbox"
          class="checkbox-input"
          :checked="checkboxState === 'checked'"
          :indeterminate="checkboxState === 'indeterminate'"
          @change="handleCheckboxChange"
          @click.stop
        />
      </div>
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
      <div v-if="isSelectionModeEnabled" class="checkbox-wrapper" @click.stop="handleCheckboxClick">
        <input
          type="checkbox"
          class="checkbox-input"
          :checked="isFileSelected(node.id)"
          @change="handleCheckboxChange"
          @click.stop
        />
      </div>
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
        :tree-structure="props.treeStructure"
        @toggle-folder="$emit('toggle-folder', $event)"
        @show-detail="$emit('show-detail', $event)"
        @node-moved="$emit('node-moved')"
        @external-drop="$emit('external-drop', $event)"
      />
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
          <button class="context-menu-item" @click.stop="handleShowDetail">
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
          <button class="context-menu-item danger" @click.stop="handleDelete">
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useFileTreeStore } from '@renderer/stores/knowledge-library/file-tree.store'
import { useFileDataStore } from '@renderer/stores/knowledge-library/file-data.store'
import { useFileSelectionStore } from '@renderer/stores/knowledge-library/file-selection.store'
import type { TreeNode, FileNode } from '@renderer/stores/knowledge-library/file.types'

const props = defineProps<{
  node: TreeNode
  expandedFolders: Set<string | number>
  knowledgeBaseId?: number
  treeStructure?: TreeNode[]
}>()

const emit = defineEmits<{
  (e: 'toggle-folder', id: string | number): void
  (e: 'show-detail', file: FileNode): void
  (e: 'node-moved'): void
  (e: 'external-drop', data: { targetPath: string; targetNode: TreeNode }): void
}>()

const fileTreeStore = useFileTreeStore()
const fileDataStore = useFileDataStore()
const selectionStore = useFileSelectionStore()

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

const handleShowDetail = (): void => {
  if (contextMenuNode.value) {
    emit('show-detail', contextMenuNode.value)
  }
  closeContextMenu()
}

const handleDelete = async (): Promise<void> => {
  if (!contextMenuNode.value || !props.knowledgeBaseId) {
    console.warn('[TreeNode] Cannot delete: missing node or knowledgeBaseId')
    return
  }

  const confirmed = window.confirm(
    `确定要删除 "${contextMenuNode.value.name}" 吗？\n\n此操作不可撤销。`
  )

  if (!confirmed) {
    return
  }

  try {
    const targetPath = contextMenuNode.value.path || contextMenuNode.value.name
    const result = await window.api.file.deleteFile(props.knowledgeBaseId, targetPath)

    if (result.success) {
      await fileDataStore.refresh()
    } else {
      alert(`删除失败: ${result.error || '未知错误'}`)
    }
  } catch (error) {
    console.error('[TreeNode] Failed to delete node:', error)
    alert(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    closeContextMenu()
  }
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

// 选择相关功能
const isSelectionModeEnabled = computed(() => {
  if (!props.knowledgeBaseId) return false
  return selectionStore.isSelectionModeEnabled(props.knowledgeBaseId)
})

const isFileSelected = (fileId: string | number): boolean => {
  if (!props.knowledgeBaseId) return false
  return selectionStore.isSelected(props.knowledgeBaseId, fileId)
}

// 计算复选框状态（用于文件夹节点，支持中间状态）
const checkboxState = computed(() => {
  if (!props.knowledgeBaseId) return 'unchecked'
  if (props.node.type === 'file') {
    return isFileSelected(props.node.id) ? 'checked' : 'unchecked'
  }
  // 文件夹节点：计算父节点状态
  return selectionStore.getParentNodeState(props.node, props.knowledgeBaseId)
})

const handleCheckboxClick = (): void => {
  if (!props.knowledgeBaseId) return

  // 对于文件夹节点，使用递归选择
  if (props.node.type === 'folder') {
    // 使用传递的完整树结构，如果不存在则使用当前节点的子树结构
    const treeStructure = props.treeStructure || (props.node.children ? [props.node] : [])
    selectionStore.selectNodeAndChildren(props.knowledgeBaseId, props.node.id, treeStructure)
  } else {
    // 文件节点：直接切换选择状态
    selectionStore.toggleSelection(props.knowledgeBaseId, props.node.id)
  }
}

const handleCheckboxChange = (event: Event): void => {
  // 这个事件处理主要用于阻止默认行为，实际逻辑在 handleCheckboxClick 中
  event.stopPropagation()
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

/* Checkbox styles */
.checkbox-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  flex-shrink: 0;
}

.checkbox-input {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
  accent-color: #4f46e5;
}
</style>

<template>
  <div class="KnowledgeView_KnowledgeDetail_Views_FileTreeView_container">
    <div v-if="loading" style="text-align: center; padding: 2rem; color: #94a3b8">加载中...</div>
    <div
      v-else-if="treeStructure.length === 0"
      style="text-align: center; padding: 2rem; color: #94a3b8"
    >
      暂无文件
    </div>
    <!-- 树形结构 -->
    <template v-else>
      <TreeNode
        v-for="node in treeStructure"
        :key="node.id"
        :node="node"
        :expanded-folders="expandedFolders"
        :knowledge-base-id="knowledgeBaseId"
        @toggle-folder="toggleFolder"
        @show-detail="$emit('show-detail', $event)"
        @node-moved="handleNodeMoved"
        @external-drop="handleExternalDrop"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch, ref } from 'vue'
import { useFileTreeStore } from '@renderer/stores/knowledge-library/file-tree.store'
import { useTaskManagerStore } from '@renderer/stores/task-manager/task-manager.store'
import TreeNode from './TreeNode.vue'
import type {
  FileNode,
  TreeNode as TreeNodeType
} from '@renderer/stores/knowledge-library/file.types'

const props = defineProps<{
  knowledgeBaseId: number
}>()

defineEmits<{
  (e: 'show-detail', file: FileNode): void
}>()

// 外部拖拽目标目录
const externalDropTarget = ref<{ targetPath: string; targetNode: TreeNodeType } | null>(null)

// 使用 Pinia Store
const fileTreeStore = useFileTreeStore()

// 从 Store 获取数据
const treeStructure = computed(() => fileTreeStore.treeStructure)
const expandedFolders = computed(() => {
  // 转换为 Set 用于模板中的 has 检查
  return new Set(fileTreeStore.expandedFolders)
})
const loading = computed(() => fileTreeStore.loading)

const toggleFolder = (id: string | number): void => {
  fileTreeStore.toggleFolder(id)
}

const handleNodeMoved = (): void => {
  // 节点移动后，树结构会自动刷新（通过 store 的 refresh）
  // 这里可以添加额外的处理逻辑
}

const handleExternalDrop = (data: { targetPath: string; targetNode: TreeNodeType }): void => {
  // 保存外部拖拽的目标目录，供 DropZone 使用
  externalDropTarget.value = data
  // 触发一个自定义事件，让 DropZone 知道目标目录
  window.dispatchEvent(
    new CustomEvent('tree-node-external-drop', {
      detail: {
        targetPath: data.targetPath,
        knowledgeBaseId: props.knowledgeBaseId
      }
    })
  )
}

// 初始化时获取文件列表
onMounted(async () => {
  await fileTreeStore.fetchFiles(props.knowledgeBaseId)
})

// 监听 knowledgeBaseId 变化，重新加载数据
watch(
  () => props.knowledgeBaseId,
  async (newId) => {
    if (newId) {
      await fileTreeStore.fetchFiles(newId)
    }
  }
)
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
</style>

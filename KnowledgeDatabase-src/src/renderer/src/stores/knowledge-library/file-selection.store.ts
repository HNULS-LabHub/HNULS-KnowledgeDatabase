import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TreeNode } from './file.types'

/**
 * 文件选择状态管理 Store
 * 负责管理跨视图的文件选择状态
 */
export const useFileSelectionStore = defineStore('file-selection', () => {
  // State: 按知识库ID存储选择状态，使用 Set 提高查询性能
  const selectedFiles = ref<Map<number, Set<string | number>>>(new Map())
  const currentKnowledgeBaseId = ref<number | null>(null)
  // 选择模式状态：按知识库ID存储是否处于选择模式
  const selectionMode = ref<Map<number, boolean>>(new Map())

  // Getters
  /**
   * 获取指定知识库的选中文件集合
   */
  function getSelectedSet(knowledgeBaseId: number): Set<string | number> {
    if (!selectedFiles.value.has(knowledgeBaseId)) {
      selectedFiles.value.set(knowledgeBaseId, new Set())
    }
    return selectedFiles.value.get(knowledgeBaseId)!
  }

  /**
   * 获取所有选中的文件ID数组
   */
  const getSelectedFiles = computed(() => {
    return (knowledgeBaseId: number): (string | number)[] => {
      const selectedSet = getSelectedSet(knowledgeBaseId)
      return Array.from(selectedSet)
    }
  })

  /**
   * 获取选中文件数量
   */
  const getSelectedCount = computed(() => {
    return (knowledgeBaseId: number): number => {
      const selectedSet = getSelectedSet(knowledgeBaseId)
      return selectedSet.size
    }
  })

  /**
   * 检查是否已全选（基于提供的文件ID列表）
   */
  const isAllSelected = computed(() => {
    return (knowledgeBaseId: number, allFileIds: (string | number)[]): boolean => {
      if (allFileIds.length === 0) return false
      const selectedSet = getSelectedSet(knowledgeBaseId)
      return allFileIds.every(id => selectedSet.has(id))
    }
  })

  // Actions
  /**
   * 切换单个文件的选择状态
   */
  function toggleSelection(knowledgeBaseId: number, fileId: string | number): void {
    const selectedSet = getSelectedSet(knowledgeBaseId)
    if (selectedSet.has(fileId)) {
      selectedSet.delete(fileId)
    } else {
      selectedSet.add(fileId)
    }
  }

  /**
   * 选择单个文件
   */
  function selectFile(knowledgeBaseId: number, fileId: string | number): void {
    const selectedSet = getSelectedSet(knowledgeBaseId)
    selectedSet.add(fileId)
  }

  /**
   * 取消选择单个文件
   */
  function deselectFile(knowledgeBaseId: number, fileId: string | number): void {
    const selectedSet = getSelectedSet(knowledgeBaseId)
    selectedSet.delete(fileId)
  }

  /**
   * 检查文件是否被选中
   */
  function isSelected(knowledgeBaseId: number, fileId: string | number): boolean {
    const selectedSet = getSelectedSet(knowledgeBaseId)
    return selectedSet.has(fileId)
  }

  /**
   * 全选指定文件列表
   */
  function selectAll(knowledgeBaseId: number, fileIds: (string | number)[]): void {
    const selectedSet = getSelectedSet(knowledgeBaseId)
    fileIds.forEach(id => selectedSet.add(id))
  }

  /**
   * 全不选（清空指定知识库的选择）
   */
  function deselectAll(knowledgeBaseId: number): void {
    const selectedSet = getSelectedSet(knowledgeBaseId)
    selectedSet.clear()
  }

  /**
   * 清空选择（同 deselectAll）
   */
  function clearSelection(knowledgeBaseId: number): void {
    deselectAll(knowledgeBaseId)
  }

  /**
   * 在树形结构中查找节点
   */
  function findNodeInTree(
    treeStructure: TreeNode[],
    nodeId: string | number
  ): TreeNode | null {
    for (const node of treeStructure) {
      if (node.id === nodeId) {
        return node
      }
      if (node.children) {
        const found = findNodeInTree(node.children, nodeId)
        if (found) return found
      }
    }
    return null
  }

  /**
   * 获取树节点的所有子节点ID（递归）
   */
  function getAllChildNodeIds(node: TreeNode): (string | number)[] {
    const ids: (string | number)[] = [node.id]
    if (node.children) {
      node.children.forEach(child => {
        ids.push(...getAllChildNodeIds(child))
      })
    }
    return ids
  }

  /**
   * 选择树节点及其所有子节点（递归选择）
   */
  function selectNodeAndChildren(
    knowledgeBaseId: number,
    nodeId: string | number,
    treeStructure: TreeNode[]
  ): void {
    const node = findNodeInTree(treeStructure, nodeId)
    if (!node) return

    // 获取当前节点及其所有子节点的ID
    const allNodeIds = getAllChildNodeIds(node)

    // 检查当前是否已全选
    const selectedSet = getSelectedSet(knowledgeBaseId)
    const isCurrentlySelected = allNodeIds.every(id => selectedSet.has(id))

    if (isCurrentlySelected) {
      // 如果已全选，则取消选择所有节点
      allNodeIds.forEach(id => selectedSet.delete(id))
    } else {
      // 如果未全选，则选择所有节点
      allNodeIds.forEach(id => selectedSet.add(id))
    }
  }

  /**
   * 计算父节点的选择状态（用于树形视图的中间状态显示）
   * @returns 'checked' | 'unchecked' | 'indeterminate'
   */
  function getParentNodeState(
    node: TreeNode,
    knowledgeBaseId: number
  ): 'checked' | 'unchecked' | 'indeterminate' {
    const selectedSet = getSelectedSet(knowledgeBaseId)

    // 如果是叶子节点，直接返回其选择状态
    if (!node.children || node.children.length === 0) {
      return selectedSet.has(node.id) ? 'checked' : 'unchecked'
    }

    // 检查所有子节点的状态
    const childrenStates = node.children.map(child =>
      getParentNodeState(child, knowledgeBaseId)
    )

    const allChecked = childrenStates.every(s => s === 'checked')
    const someChecked = childrenStates.some(
      s => s === 'checked' || s === 'indeterminate'
    )

    if (allChecked) return 'checked'
    if (someChecked) return 'indeterminate'
    return 'unchecked'
  }

  /**
   * 获取树中所有节点的ID（扁平化）
   */
  function getAllNodeIds(treeStructure: TreeNode[]): (string | number)[] {
    const ids: (string | number)[] = []
    function traverse(nodes: TreeNode[]) {
      nodes.forEach(node => {
        ids.push(node.id)
        if (node.children) {
          traverse(node.children)
        }
      })
    }
    traverse(treeStructure)
    return ids
  }

  /**
   * 设置当前知识库ID
   */
  function setCurrentKnowledgeBaseId(knowledgeBaseId: number | null): void {
    currentKnowledgeBaseId.value = knowledgeBaseId
  }

  /**
   * 切换选择模式
   */
  function toggleSelectionMode(knowledgeBaseId: number): void {
    const currentMode = selectionMode.value.get(knowledgeBaseId) || false
    selectionMode.value.set(knowledgeBaseId, !currentMode)
    
    // 如果退出选择模式，清空选择
    if (currentMode) {
      clearSelection(knowledgeBaseId)
    }
  }

  /**
   * 设置选择模式
   */
  function setSelectionMode(knowledgeBaseId: number, enabled: boolean): void {
    selectionMode.value.set(knowledgeBaseId, enabled)
    
    // 如果禁用选择模式，清空选择
    if (!enabled) {
      clearSelection(knowledgeBaseId)
    }
  }

  /**
   * 检查是否处于选择模式
   */
  function isSelectionModeEnabled(knowledgeBaseId: number): boolean {
    return selectionMode.value.get(knowledgeBaseId) || false
  }

  return {
    // State
    selectedFiles,
    currentKnowledgeBaseId,
    selectionMode,
    // Getters
    getSelectedFiles,
    getSelectedCount,
    isAllSelected,
    // Actions
    toggleSelection,
    selectFile,
    deselectFile,
    isSelected,
    selectAll,
    deselectAll,
    clearSelection,
    selectNodeAndChildren,
    getParentNodeState,
    getAllNodeIds,
    setCurrentKnowledgeBaseId,
    toggleSelectionMode,
    setSelectionMode,
    isSelectionModeEnabled
  }
})

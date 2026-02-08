import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useFileDataStore } from './file-data.store'
import type { FileNode, TreeNode } from './file.types'
import { FileDataSource } from './file.datasource'
import type { MoveResult, BatchMoveResult } from './file.datasource'

/**
 * 文件树 Store（树形视图）
 */
export const useFileTreeStore = defineStore('file-tree', () => {
  const fileDataStore = useFileDataStore()

  // State（视图）
  // 使用数组而不是 Set，避免 Pinia 序列化问题
  const expandedFolders = ref<(string | number)[]>([])

  // Getters
  /**
   * 将扁平数组转换为树形结构
   */
  const treeStructure = computed(() => {
    return buildTreeFromFiles(fileDataStore.files)
  })

  // Actions
  /**
   * 获取文件列表
   */
  async function fetchFiles(knowledgeBaseId: number): Promise<void> {
    await fileDataStore.fetchFiles(knowledgeBaseId)
  }

  /**
   * 切换文件夹展开/折叠状态
   */
  function toggleFolder(folderId: string | number): void {
    const index = expandedFolders.value.indexOf(folderId)
    if (index > -1) {
      expandedFolders.value.splice(index, 1)
    } else {
      expandedFolders.value.push(folderId)
    }
  }

  /**
   * 展开文件夹
   */
  function expandFolder(folderId: string | number): void {
    if (!expandedFolders.value.includes(folderId)) {
      expandedFolders.value.push(folderId)
    }
  }

  /**
   * 折叠文件夹
   */
  function collapseFolder(folderId: string | number): void {
    const index = expandedFolders.value.indexOf(folderId)
    if (index > -1) {
      expandedFolders.value.splice(index, 1)
    }
  }

  /**
   * 展开所有文件夹
   */
  function expandAll(): void {
    const allFolderIds = treeStructure.value
      .filter((node) => node.type === 'folder')
      .map((node) => node.id)
    expandedFolders.value = [...allFolderIds]
  }

  /**
   * 折叠所有文件夹
   */
  function collapseAll(): void {
    expandedFolders.value = []
  }

  /**
   * 刷新数据
   */
  async function refresh(): Promise<void> {
    await fileDataStore.refresh()
  }

  /**
   * 移动文件/目录到新位置
   */
  async function moveNode(
    knowledgeBaseId: number,
    sourcePath: string,
    targetPath: string,
    conflictPolicy: 'rename' | 'skip' | 'overwrite' = 'rename'
  ): Promise<MoveResult> {
    try {
      // 验证移动合法性
      const validation = validateMove(sourcePath, targetPath)
      if (!validation.valid) {
        return {
          success: false,
          error: validation.reason || 'Invalid move operation'
        }
      }

      const result = await FileDataSource.moveFile(
        knowledgeBaseId,
        sourcePath,
        targetPath,
        conflictPolicy
      )

      if (result.success) {
        // 刷新树结构（全局数据源）
        await fileDataStore.refresh()
      }

      return result
    } catch (error) {
      console.error('Failed to move node:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 批量移动文件/目录
   */
  async function moveMultipleNodes(
    knowledgeBaseId: number,
    moves: Array<{ source: string; target: string }>,
    conflictPolicy: 'rename' | 'skip' | 'overwrite' = 'rename'
  ): Promise<BatchMoveResult> {
    try {
      const result = await FileDataSource.moveMultiple(knowledgeBaseId, moves, conflictPolicy)

      // 刷新树结构（全局数据源）
      await fileDataStore.refresh()

      return result
    } catch (error) {
      console.error('Failed to move nodes:', error)
      return {
        total: moves.length,
        success: 0,
        failed: moves.length,
        results: moves.map((move) => ({
          source: move.source,
          target: move.target,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }))
      }
    }
  }

  /**
   * 根据路径查找节点
   */
  function findNodeByPath(nodePath: string): TreeNode | null {
    const searchInNodes = (nodes: TreeNode[]): TreeNode | null => {
      for (const node of nodes) {
        if (node.path === nodePath) {
          return node
        }
        if (node.children) {
          const found = searchInNodes(node.children)
          if (found) return found
        }
      }
      return null
    }
    return searchInNodes(treeStructure.value)
  }

  /**
   * 验证移动操作的合法性
   */
  function validateMove(
    sourcePath: string,
    targetPath: string
  ): { valid: boolean; reason?: string } {
    const sourceNode = findNodeByPath(sourcePath)
    if (!sourceNode) {
      return { valid: false, reason: 'Source node not found' }
    }

    // 如果目标路径为空，表示移动到根目录，这是合法的
    if (!targetPath) {
      return { valid: true }
    }

    const targetNode = findNodeByPath(targetPath)
    if (!targetNode) {
      // 目标节点不存在，可能是新目录，允许创建
      return { valid: true }
    }

    // 不能移动到自身
    if (sourceNode.id === targetNode.id) {
      return { valid: false, reason: 'Cannot move to the same location' }
    }

    // 目标必须是目录
    if (targetNode.type !== 'folder') {
      return { valid: false, reason: 'Target must be a folder' }
    }

    // 不能移动到子目录（会形成循环）
    if (isDescendant(sourceNode, targetNode)) {
      return { valid: false, reason: 'Cannot move directory into itself or its subdirectory' }
    }

    // 不能移动到同一父目录（没有实际意义）
    const sourceParentPath = getParentPath(sourcePath)
    if (sourceParentPath === targetPath) {
      return { valid: false, reason: 'Already in target location' }
    }

    return { valid: true }
  }

  /**
   * 检查 target 是否是 source 的后代节点
   */
  function isDescendant(ancestor: TreeNode, node: TreeNode): boolean {
    if (!ancestor.children) return false
    for (const child of ancestor.children) {
      if (child.id === node.id) return true
      if (isDescendant(child, node)) return true
    }
    return false
  }

  /**
   * 获取父目录路径
   */
  function getParentPath(nodePath: string): string {
    const parts = nodePath.split('/').filter(Boolean)
    if (parts.length <= 1) return ''
    return parts.slice(0, -1).join('/')
  }

  return {
    // State
    expandedFolders,
    // Getters
    treeStructure,
    loading: computed(() => fileDataStore.loading),
    error: computed(() => fileDataStore.error),
    // Actions
    fetchFiles,
    toggleFolder,
    expandFolder,
    collapseFolder,
    expandAll,
    collapseAll,
    refresh,
    moveNode,
    moveMultipleNodes,
    findNodeByPath,
    validateMove
  }
})

/**
 * 将扁平文件数组转换为树形结构
 */
function buildTreeFromFiles(files: FileNode[]): TreeNode[] {
  // 创建路径到节点的映射
  const pathMap = new Map<string, TreeNode>()
  const rootNodes: TreeNode[] = []

  // 按路径排序，确保父目录在前
  const sortedFiles = [...files].sort((a, b) => {
    const pathA = a.path || ''
    const pathB = b.path || ''
    return pathA.localeCompare(pathB)
  })

  for (const file of sortedFiles) {
    const path = file.path || ''
    const parts = path.split('/').filter(Boolean)

    // 构建当前路径的层级结构
    let currentPath = ''
    let parentNode: TreeNode | null = null

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      currentPath = currentPath ? `${currentPath}/${part}` : part

      if (!pathMap.has(currentPath)) {
        const node: TreeNode = {
          id: currentPath,
          name: part,
          type: isLast && file.type === 'file' ? 'file' : 'folder',
          path: currentPath,
          level: i,
          children: []
        }

        // 如果是文件且是最后一个部分，复制文件的其他属性
        if (isLast && file.type === 'file') {
          Object.assign(node, {
            size: file.size,
            extension: file.extension,
            updateTime: file.updateTime,
            uploadTime: file.uploadTime
          })
        }

        pathMap.set(currentPath, node)

        if (parentNode) {
          if (!parentNode.children) {
            parentNode.children = []
          }
          parentNode.children.push(node)
        } else {
          rootNodes.push(node)
        }
      }

      parentNode = pathMap.get(currentPath) || null
    }
  }

  return rootNodes
}

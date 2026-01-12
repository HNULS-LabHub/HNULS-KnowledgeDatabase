import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { FileDataSource } from './file.datasource'
import type { FileNode, TreeNode } from './file.types'

/**
 * 文件树 Store（树形视图）
 */
export const useFileTreeStore = defineStore('file-tree', () => {
  // State
  const files = ref<FileNode[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentKnowledgeBaseId = ref<number | null>(null)
  // 使用数组而不是 Set，避免 Pinia 序列化问题
  const expandedFolders = ref<(string | number)[]>([])

  // Getters
  /**
   * 将扁平数组转换为树形结构
   */
  const treeStructure = computed(() => {
    return buildTreeFromFiles(files.value)
  })

  // Actions
  /**
   * 获取文件列表
   */
  async function fetchFiles(knowledgeBaseId: number): Promise<void> {
    loading.value = true
    error.value = null
    currentKnowledgeBaseId.value = knowledgeBaseId
    
    try {
      files.value = await FileDataSource.getAll(knowledgeBaseId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch files'
      console.error('Failed to fetch files:', err)
      files.value = []
    } finally {
      loading.value = false
    }
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
    if (currentKnowledgeBaseId.value !== null) {
      await fetchFiles(currentKnowledgeBaseId.value)
    }
  }

  return {
    // State
    files,
    loading,
    error,
    expandedFolders,
    // Getters
    treeStructure,
    // Actions
    fetchFiles,
    toggleFolder,
    expandFolder,
    collapseFolder,
    expandAll,
    collapseAll,
    refresh
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

import { ipcRenderer } from 'electron'
import type { FileNode } from '../../renderer/src/stores/knowledge-library/file.types'
import type { MoveResult, BatchMoveResult } from '../types/file.types'

/**
 * IPC 响应格式
 */
interface IPCResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export const fileAPI = {
  /**
   * 获取指定知识库的所有文件列表
   */
  getAll: (knowledgeBaseId: number): Promise<FileNode[]> => {
    return ipcRenderer
      .invoke('file:getall', knowledgeBaseId)
      .then((response: IPCResponse<FileNode[]>) => {
        if (response.success && response.data) {
          return response.data
        }
        throw new Error(
          response.error || `Failed to get files for knowledge base ${knowledgeBaseId}`
        )
      })
  },

  /**
   * 扫描指定知识库的文档目录
   */
  scanDirectory: (knowledgeBaseId: number): Promise<FileNode[]> => {
    return ipcRenderer
      .invoke('file:scandirectory', knowledgeBaseId)
      .then((response: IPCResponse<FileNode[]>) => {
        if (response.success && response.data) {
          return response.data
        }
        throw new Error(
          response.error || `Failed to scan directory for knowledge base ${knowledgeBaseId}`
        )
      })
  },

  /**
   * 移动文件/目录到新位置
   */
  moveFile: (
    knowledgeBaseId: number,
    sourcePath: string,
    targetPath: string,
    conflictPolicy: 'rename' | 'skip' | 'overwrite' = 'rename'
  ): Promise<MoveResult> => {
    return ipcRenderer
      .invoke('file:movefile', knowledgeBaseId, sourcePath, targetPath, conflictPolicy)
      .then((response: IPCResponse<{ newPath?: string }>) => {
        if (response.success) {
          return {
            success: true,
            newPath: response.data?.newPath
          }
        }
        return {
          success: false,
          error: response.error || 'Failed to move file'
        }
      })
      .catch((error) => {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
  },

  /**
   * 批量移动文件/目录
   */
  moveMultiple: (
    knowledgeBaseId: number,
    moves: Array<{ source: string; target: string }>,
    conflictPolicy: 'rename' | 'skip' | 'overwrite' = 'rename'
  ): Promise<BatchMoveResult> => {
    return ipcRenderer
      .invoke('file:movemultiple', knowledgeBaseId, moves, conflictPolicy)
      .then((response: IPCResponse<BatchMoveResult>) => {
        if (response.success && response.data) {
          return response.data
        }
        throw new Error(response.error || 'Failed to move files')
      })
  },

  /**
   * 删除文件/目录
   */
  deleteFile: (
    knowledgeBaseId: number,
    filePath: string
  ): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer
      .invoke('file:deletefile', knowledgeBaseId, filePath)
      .then((response: IPCResponse<void>) => {
        if (response.success) {
          return { success: true }
        }
        return {
          success: false,
          error: response.error || 'Failed to delete file'
        }
      })
      .catch((error) => {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
  }
}

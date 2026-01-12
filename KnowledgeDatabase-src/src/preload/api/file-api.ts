import { ipcRenderer } from 'electron'
import type { FileNode } from '../../renderer/src/stores/knowledge-library/file.types'

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
  }
}

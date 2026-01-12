import type { FileNode } from './file.types'

/**
 * IPC 响应格式
 */
interface IPCResponse<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * 文件数据源适配器
 * 负责调用 Electron 后端 API
 */
export const FileDataSource = {
  /**
   * 获取指定知识库的所有文件列表（扁平结构）
   * @param knowledgeBaseId 知识库ID
   * @returns 文件列表（扁平数组）
   */
  async getAll(knowledgeBaseId: number): Promise<FileNode[]> {
    if (!window.api?.file) {
      throw new Error('File API is not available. Please run in Electron environment.')
    }
    return await window.api.file.getAll(knowledgeBaseId)
  },

  /**
   * 扫描指定知识库的文档目录
   * @param knowledgeBaseId 知识库ID
   * @returns 扫描结果（文件列表）
   */
  async scanDirectory(knowledgeBaseId: number): Promise<FileNode[]> {
    if (!window.api?.file) {
      throw new Error('File API is not available. Please run in Electron environment.')
    }
    return await window.api.file.scanDirectory(knowledgeBaseId)
  }
}

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
 * 移动结果
 */
export interface MoveResult {
  success: boolean
  newPath?: string
  error?: string
}

/**
 * 批量移动结果
 */
export interface BatchMoveResult {
  total: number
  success: number
  failed: number
  results: Array<{ source: string; target: string; success: boolean; error?: string; newPath?: string }>
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
  },

  /**
   * 移动文件/目录到新位置
   * @param knowledgeBaseId 知识库ID
   * @param sourcePath 源路径（相对路径）
   * @param targetPath 目标目录路径（相对路径，空字符串表示根目录）
   * @param conflictPolicy 冲突处理策略
   * @returns 移动结果
   */
  async moveFile(
    knowledgeBaseId: number,
    sourcePath: string,
    targetPath: string,
    conflictPolicy: 'rename' | 'skip' | 'overwrite' = 'rename'
  ): Promise<MoveResult> {
    if (!window.api?.file) {
      throw new Error('File API is not available. Please run in Electron environment.')
    }
    return await window.api.file.moveFile(knowledgeBaseId, sourcePath, targetPath, conflictPolicy)
  },

  /**
   * 批量移动文件/目录
   * @param knowledgeBaseId 知识库ID
   * @param moves 移动操作列表
   * @param conflictPolicy 冲突处理策略
   * @returns 批量移动结果
   */
  async moveMultiple(
    knowledgeBaseId: number,
    moves: Array<{ source: string; target: string }>,
    conflictPolicy: 'rename' | 'skip' | 'overwrite' = 'rename'
  ): Promise<BatchMoveResult> {
    if (!window.api?.file) {
      throw new Error('File API is not available. Please run in Electron environment.')
    }
    return await window.api.file.moveMultiple(knowledgeBaseId, moves, conflictPolicy)
  }
}

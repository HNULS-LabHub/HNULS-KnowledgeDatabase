/**
 * Preload API 类型定义统一导出
 * 按业务域组织，避免单个文件过大
 */

// 通用类型
export interface APIResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// 业务域类型导出
export type { TestAPI } from './test.types'
export type { KnowledgeLibraryAPI } from './knowledge-library.types'
export type { FileAPI, FileNode } from './file.types'
export type { FileImportAPI, ImportResult, FileImportOptions } from './file-import.types'
export type { UserConfigAPI, UserConfig, MinerUConfig } from './user-config.types'

// MinerU
export * from './mineru.types'
export * from './mineru-file-state.types'
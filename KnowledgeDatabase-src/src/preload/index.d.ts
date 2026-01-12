import { ElectronAPI } from '@electron-toolkit/preload'
import type { TestAPI, KnowledgeLibraryAPI, FileAPI } from './types'

/**
 * Window API 类型定义
 * 只负责组织 window.api 的结构，具体类型定义在 types 目录下按业务域拆分
 */
declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      test: TestAPI
      knowledgeLibrary: KnowledgeLibraryAPI
      file: FileAPI
      // TODO: 添加其他业务域
      // database: DatabaseAPI
    }
  }
}

import { ElectronAPI } from '@electron-toolkit/preload'
import type { TestAPI, KnowledgeLibraryAPI, FileAPI, FileImportAPI, UserConfigAPI } from './types'

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
      fileImport: FileImportAPI
      userConfig: UserConfigAPI
      utils: {
        getPathForFile: (file: File) => string
      }
      // TODO: 添加其他业务域
      // database: DatabaseAPI
    }
  }
}

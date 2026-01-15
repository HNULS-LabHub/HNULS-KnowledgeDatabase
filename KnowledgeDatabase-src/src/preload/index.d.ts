import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  TestAPI,
  KnowledgeLibraryAPI,
  FileAPI,
  FileImportAPI,
  UserConfigAPI,
  MinerUAPI,
  MinerUFileParsingState,
  MinerUGetFileParsingStateRequest,
  MinerUSetActiveVersionRequest
} from './types'

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
      minerU: MinerUAPI & {
        getFileParsingState: (
          req: MinerUGetFileParsingStateRequest
        ) => Promise<{ success: boolean; data?: MinerUFileParsingState; error?: string }>
        setActiveVersion: (
          req: MinerUSetActiveVersionRequest
        ) => Promise<{ success: boolean; data?: MinerUFileParsingState; error?: string }>
      }
      utils: {
        getPathForFile: (file: File) => string
      }
      // TODO: 添加其他业务域
      // database: DatabaseAPI
    }
  }
}

export {}

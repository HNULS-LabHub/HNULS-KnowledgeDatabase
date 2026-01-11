import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  KnowledgeBaseMeta,
  CreateKnowledgeBaseData,
  UpdateKnowledgeBaseData
} from '../main/services/knowledgeBase-library/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      test: {
        ping(): Promise<{ success: boolean; message: string; timestamp: number }>
        echo(message: string): Promise<{ success: boolean; echo: string }>
      }
      knowledgeLibrary: {
        getAll(): Promise<KnowledgeBaseMeta[]>
        getById(id: number): Promise<KnowledgeBaseMeta>
        create(data: CreateKnowledgeBaseData): Promise<KnowledgeBaseMeta>
        update(id: number, data: UpdateKnowledgeBaseData): Promise<KnowledgeBaseMeta>
        delete(id: number): Promise<void>
      }
      // TODO: 添加其他业务域的类型定义
      // file: FileAPI
      // database: DatabaseAPI
    }
  }
}

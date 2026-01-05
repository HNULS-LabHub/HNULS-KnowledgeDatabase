import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      test: {
        ping(): Promise<{ success: boolean; message: string; timestamp: number }>
        echo(message: string): Promise<{ success: boolean; echo: string }>
      }
      // TODO: 添加其他业务域的类型定义
      // file: FileAPI
      // database: DatabaseAPI
    }
  }
}

import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { testAPI } from '../api/test-api'
import { knowledgeLibraryAPI } from '../api/knowledge-library-api'

// 自定义 API 集合
const customAPI = {
  test: testAPI,
  knowledgeLibrary: knowledgeLibraryAPI
  // TODO: 添加其他业务域 API
  // file: fileAPI,
  // database: databaseAPI,
}

// 安全地暴露 API 到渲染进程
export function exposeBridge(): void {
  if (process.contextIsolated) {
    try {
      // 暴露 electron-toolkit 提供的标准 API
      contextBridge.exposeInMainWorld('electron', electronAPI)

      // 暴露自定义业务 API
      contextBridge.exposeInMainWorld('api', customAPI)

      console.log('Context bridge APIs exposed successfully')
    } catch (error) {
      console.error('Failed to expose context bridge APIs:', error)
    }
  } else {
    // 如果没有启用上下文隔离，直接挂载到 window 对象
    // 注意：这种方式安全性较低，不推荐在生产环境使用
    ;(window as any).electron = electronAPI
    ;(window as any).api = customAPI

    console.warn('Context isolation is disabled. APIs attached to window object.')
  }
}

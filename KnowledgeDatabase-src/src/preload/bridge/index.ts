import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { testAPI } from '../api/test-api'
import { knowledgeLibraryAPI } from '../api/knowledge-library-api'
import { fileAPI } from '../api/file-api'
import { fileImportAPI } from '../api/file-import-api'
import { userConfigAPI } from '../api/user-config-api'
import { minerUAPI } from '../api/mineru-api'
import { chunkingAPI } from '../api/chunking-api'
import { utilsAPI } from '../api/utils-api'
import { modelConfigAPI } from '../api/model-config-api'
import { knowledgeConfigAPI } from '../api/knowledge-config-api'
import { taskMonitorAPI } from '../api/task-monitor-api'
import { embeddingAPI } from '../api/embedding-api'
import { vectorIndexerAPI } from '../api/vector-indexer-api'
import { vectorRetrievalAPI } from '../api/vector-retrieval-api'
import { agentAPI } from '../api/agent-api'

// 自定义 API 集合
const customAPI = {
  test: testAPI,
  knowledgeLibrary: knowledgeLibraryAPI,
  file: fileAPI,
  fileImport: fileImportAPI,
  userConfig: userConfigAPI,
  minerU: minerUAPI,
  chunking: chunkingAPI,
  modelConfig: modelConfigAPI,
  knowledgeConfig: knowledgeConfigAPI,
  taskMonitor: taskMonitorAPI,
  embedding: embeddingAPI,
  vectorIndexer: vectorIndexerAPI,
  vectorRetrieval: vectorRetrievalAPI,
  agent: agentAPI,
  // Electron 文件路径工具
  utils: utilsAPI
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

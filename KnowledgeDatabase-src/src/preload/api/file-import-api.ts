import { ipcRenderer } from 'electron'
import type { FileImportOptions, ImportResult, ImportProgress } from '../types/file-import.types'

/**
 * IPC 响应格式
 */
interface IPCResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export const fileImportAPI = {
  /**
   * 异步导入（立即返回任务ID，后台处理）
   */
  importAsync: (
    knowledgeBaseId: number,
    paths: string[],
    options?: FileImportOptions
  ): Promise<{ taskId: string }> => {
    console.log('[FileImportAPI] importAsync called', { knowledgeBaseId, paths, options })
    return ipcRenderer
      .invoke('file-import:import-async', knowledgeBaseId, paths, options)
      .then((response: IPCResponse<{ taskId: string }>) => {
        console.log('[FileImportAPI] Async import started', response)
        if (response.success && response.data) {
          return response.data
        }
        throw new Error(response.error || 'Failed to start import')
      })
      .catch((error) => {
        console.error('[FileImportAPI] Async import error', error)
        throw error
      })
  },

  /**
   * 监听导入进度
   */
  onProgress: (callback: (progress: ImportProgress) => void): (() => void) => {
    const handler = (_event: any, progress: ImportProgress) => {
      callback(progress)
    }
    ipcRenderer.on('file-import:progress', handler)
    // 返回取消监听的函数
    return () => {
      ipcRenderer.removeListener('file-import:progress', handler)
    }
  },

  /**
   * 监听导入完成
   */
  onComplete: (
    callback: (data: { taskId: string; result: ImportResult }) => void
  ): (() => void) => {
    const handler = (_event: any, data: { taskId: string; result: ImportResult }) => {
      callback(data)
    }
    ipcRenderer.on('file-import:complete', handler)
    return () => {
      ipcRenderer.removeListener('file-import:complete', handler)
    }
  },

  /**
   * 监听导入错误
   */
  onError: (callback: (data: { taskId: string; error: string }) => void): (() => void) => {
    const handler = (_event: any, data: { taskId: string; error: string }) => {
      callback(data)
    }
    ipcRenderer.on('file-import:error', handler)
    return () => {
      ipcRenderer.removeListener('file-import:error', handler)
    }
  },

  /**
   * 同步导入（保留向后兼容）
   */
  import: (
    knowledgeBaseId: number,
    paths: string[],
    options?: FileImportOptions
  ): Promise<ImportResult> => {
    console.log('[FileImportAPI] import called', { knowledgeBaseId, paths, options })
    return ipcRenderer
      .invoke('file-import:import', knowledgeBaseId, paths, options)
      .then((response: IPCResponse<ImportResult>) => {
        console.log('[FileImportAPI] IPC response', response)
        if (response.success && response.data) {
          return response.data
        }
        throw new Error(response.error || 'Failed to import files')
      })
      .catch((error) => {
        console.error('[FileImportAPI] IPC error', error)
        throw error
      })
  }
}

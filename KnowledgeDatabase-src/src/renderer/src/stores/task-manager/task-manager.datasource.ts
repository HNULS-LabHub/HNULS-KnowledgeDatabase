import { mockImportProgress, mockImportResult } from './task-manager.mock'

export const TaskManagerDataSource = {
  async startImport(knowledgeBaseId: number, paths: string[], options: any) {
    if (window.api?.fileImport?.importAsync) {
      return await window.api.fileImport.importAsync(knowledgeBaseId, paths, options)
    }
    // Mock implementation for non-Electron environment
    const taskId = `mock-${Date.now()}`
    return { taskId }
  },

  setupProgressListener(callback: (progress: any) => void) {
    if (window.api?.fileImport?.onProgress) {
      return window.api.fileImport.onProgress(callback)
    }
    // No-op in non-Electron environment
    return () => {}
  },

  setupCompleteListener(callback: (data: any) => void) {
    if (window.api?.fileImport?.onComplete) {
      return window.api.fileImport.onComplete(callback)
    }
    // No-op in non-Electron environment
    return () => {}
  },

  setupErrorListener(callback: (error: any) => void) {
    if (window.api?.fileImport?.onError) {
      return window.api.fileImport.onError(callback)
    }
    // No-op in non-Electron environment
    return () => {}
  }
}
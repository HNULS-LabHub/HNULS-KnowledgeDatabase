import { ipcRenderer } from 'electron'
import type { FileImportOptions, ImportResult } from '../types/file-import.types'

/**
 * IPC 响应格式
 */
interface IPCResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export const fileImportAPI = {
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

import type { ImportProgress, ImportResult } from './task-manager.types'

export function mockImportProgress(taskId: string): ImportProgress {
  return {
    taskId,
    percentage: 0,
    processed: 0,
    totalFiles: 0,
    imported: 0,
    failed: 0,
    currentFile: ''
  }
}

export function mockImportResult(): ImportResult {
  return {
    imported: 0,
    failed: 0
  }
}

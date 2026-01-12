/**
 * 文件导入结果
 */
export interface ImportResult {
  totalInput: number
  totalFilesDiscovered: number
  imported: number
  skipped: number
  failed: number
  errors: Array<{ sourcePath: string; reason: string }>
  created: Array<{ sourcePath: string; targetPath: string }>
}

export interface FileImportOptions {
  keepStructure?: boolean
  conflictPolicy?: 'rename' | 'skip'
  targetPath?: string // 目标目录路径（相对路径，如 "folder/subfolder" 或 "" 表示根目录）
}

/**
 * 导入进度信息
 */
export interface ImportProgress {
  taskId: string
  totalFiles: number
  processed: number
  imported: number
  failed: number
  currentFile?: string
  percentage: number
}

/**
 * 文件导入 API
 */
export interface FileImportAPI {
  /**
   * 启动异步导入任务，立即返回任务ID
   */
  importAsync(
    knowledgeBaseId: number,
    paths: string[],
    options?: FileImportOptions
  ): Promise<{ taskId: string }>
  /**
   * 监听导入进度
   */
  onProgress(callback: (progress: ImportProgress) => void): () => void
  /**
   * 监听导入完成
   */
  onComplete(callback: (data: { taskId: string; result: ImportResult }) => void): () => void
  /**
   * 监听导入错误
   */
  onError(callback: (data: { taskId: string; error: string }) => void): () => void
  /**
   * 同步导入（保留向后兼容）
   */
  import(
    knowledgeBaseId: number,
    paths: string[],
    options?: FileImportOptions
  ): Promise<ImportResult>
}

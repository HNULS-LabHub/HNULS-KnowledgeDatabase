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
}

/**
 * 文件导入 API
 */
export interface FileImportAPI {
  import(
    knowledgeBaseId: number,
    paths: string[],
    options?: FileImportOptions
  ): Promise<ImportResult>
}

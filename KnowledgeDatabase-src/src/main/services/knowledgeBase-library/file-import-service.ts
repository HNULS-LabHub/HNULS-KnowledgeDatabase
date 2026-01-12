import * as fs from 'fs/promises'
import * as path from 'path'
import { logger } from '../logger'
import { DocumentService } from './document-service'
import { KnowledgeLibraryService } from './knowledge-library-service'

export interface FileImportOptions {
  keepStructure?: boolean
  conflictPolicy?: 'rename' | 'skip'
}

/**
 * 导入进度回调
 */
export interface ImportProgressCallback {
  (progress: {
    totalFiles: number
    processed: number
    imported: number
    failed: number
    currentFile?: string
    percentage: number
  }): void
}

export interface ImportResult {
  totalInput: number
  totalFilesDiscovered: number
  imported: number
  skipped: number
  failed: number
  errors: Array<{ sourcePath: string; reason: string }>
  created: Array<{ sourcePath: string; targetPath: string }>
}

/**
 * 文件导入服务
 * 将外部文件/目录复制到指定知识库的文档目录下
 */
export class FileImportService {
  constructor(
    private knowledgeLibraryService: KnowledgeLibraryService,
    private documentService: DocumentService
  ) {}

  /**
   * 导入文件/目录到知识库（带进度回调）
   */
  async importIntoKnowledgeBase(
    knowledgeBaseId: number,
    inputPaths: string[],
    options?: FileImportOptions,
    progressCallback?: ImportProgressCallback
  ): Promise<ImportResult> {
    logger.info('[FileImportService] importIntoKnowledgeBase started', {
      knowledgeBaseId,
      inputPathsCount: inputPaths.length,
      inputPaths,
      options
    })

    const keepStructure = options?.keepStructure ?? true
    const conflictPolicy = options?.conflictPolicy ?? 'rename'

    const result: ImportResult = {
      totalInput: inputPaths.length,
      totalFilesDiscovered: 0,
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      created: []
    }

    // 获取知识库元数据
    logger.info('[FileImportService] Fetching knowledge base metadata', { knowledgeBaseId })
    const kb = await this.knowledgeLibraryService.getById(knowledgeBaseId)
    if (!kb || !kb.documentPath) {
      logger.error('[FileImportService] Knowledge base not found or missing documentPath', {
        knowledgeBaseId,
        kb
      })
      throw new Error(`Knowledge base ${knowledgeBaseId} not found or missing documentPath`)
    }

    // 文档目录
    const targetBase = this.documentService.getFullDirectoryPath(kb.documentPath)
    logger.info('[FileImportService] Target directory', { targetBase, documentPath: kb.documentPath })

    // 收集所有待导入的文件列表
    const filesToImport: Array<{ source: string; relative: string }> = []

    logger.info('[FileImportService] Collecting files to import', { inputPathsCount: inputPaths.length })
    for (const inputPath of inputPaths) {
      try {
        logger.info('[FileImportService] Processing input path', { inputPath })
        const stats = await fs.stat(inputPath)
        const baseName = path.basename(inputPath)

        if (stats.isDirectory()) {
          logger.info('[FileImportService] Input is directory, collecting files', { inputPath, baseName })
          // 递归目录
          const items = await this.collectFiles(inputPath, keepStructure ? baseName : '')
          logger.info('[FileImportService] Collected files from directory', {
            inputPath,
            filesCount: items.length
          })
          filesToImport.push(...items)
        } else if (stats.isFile()) {
          logger.info('[FileImportService] Input is file', { inputPath, baseName })
          const relative = keepStructure ? baseName : path.basename(inputPath)
          filesToImport.push({ source: inputPath, relative })
        }
      } catch (error) {
        logger.error('[FileImportService] Failed to access path', { inputPath, error })
        result.failed += 1
        result.errors.push({ sourcePath: inputPath, reason: 'access_failed' })
      }
    }

    result.totalFilesDiscovered = filesToImport.length
    logger.info('[FileImportService] Files collection completed', {
      totalFilesDiscovered: result.totalFilesDiscovered,
      filesToImport: filesToImport.map((f) => ({ source: f.source, relative: f.relative }))
    })

    // 逐个导入
    logger.info('[FileImportService] Starting file import', { filesCount: filesToImport.length })
    const totalFiles = filesToImport.length

    for (let i = 0; i < filesToImport.length; i++) {
      const item = filesToImport[i]
      try {
        const targetPath = await this.getWritablePath(path.join(targetBase, item.relative), conflictPolicy)

        logger.info('[FileImportService] Copying file', { source: item.source, target: targetPath })
        await fs.mkdir(path.dirname(targetPath), { recursive: true })
        await fs.copyFile(item.source, targetPath)

        result.imported += 1
        result.created.push({
          sourcePath: item.source,
          targetPath
        })
        logger.info('[FileImportService] File copied successfully', {
          source: item.source,
          target: targetPath
        })
      } catch (error) {
        logger.error('[FileImportService] Failed to import file', { source: item.source, error })
        result.failed += 1
        result.errors.push({ sourcePath: item.source, reason: 'copy_failed' })
      }

      // 发送进度更新
      if (progressCallback) {
        const processed = i + 1
        const percentage = totalFiles > 0 ? Math.round((processed / totalFiles) * 100) : 0
        progressCallback({
          totalFiles,
          processed,
          imported: result.imported,
          failed: result.failed,
          currentFile: path.basename(item.source),
          percentage
        })
      }
    }

    logger.info('[FileImportService] Import completed', result)
    return result
  }

  /**
   * 递归收集目录下所有文件
   */
  private async collectFiles(root: string, prefix: string): Promise<Array<{ source: string; relative: string }>> {
    const collected: Array<{ source: string; relative: string }> = []

    const walk = async (current: string, relativeBase: string) => {
      const entries = await fs.readdir(current, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        const fullPath = path.join(current, entry.name)
        const rel = relativeBase ? path.join(relativeBase, entry.name) : entry.name
        if (entry.isDirectory()) {
          await walk(fullPath, rel)
        } else if (entry.isFile()) {
          collected.push({ source: fullPath, relative: rel })
        }
      }
    }

    await walk(root, prefix)
    return collected
  }

  /**
   * 根据冲突策略返回可写路径
   */
  private async getWritablePath(targetPath: string, conflictPolicy: 'rename' | 'skip'): Promise<string> {
    try {
      await fs.access(targetPath)
      if (conflictPolicy === 'skip') {
        throw new Error('file_exists')
      }

      // rename
      const { dir, name, ext } = path.parse(targetPath)
      let counter = 1
      let candidate = path.join(dir, `${name} (${counter})${ext}`)
      while (true) {
        try {
          await fs.access(candidate)
          counter += 1
          candidate = path.join(dir, `${name} (${counter})${ext}`)
        } catch {
          return candidate
        }
      }
    } catch {
      // 不存在，直接使用
      return targetPath
    }
  }
}

import { IpcMainInvokeEvent } from 'electron'
import { BaseIPCHandler } from './base-handler'
import { KnowledgeLibraryService } from '../services/knowledgeBase-library'
import { DocumentService } from '../services/knowledgeBase-library/document-service'
import { FileImportService, FileImportOptions } from '../services/knowledgeBase-library/file-import-service'
import { logger } from '../services/logger'

/**
 * 文件导入 IPC 处理器
 */
export class FileImportIPCHandler extends BaseIPCHandler {
  private documentService: DocumentService
  private importService: FileImportService

  constructor(private knowledgeLibraryService: KnowledgeLibraryService) {
    super()
    this.documentService = new DocumentService()
    // knowledgeLibraryService 被传递给 FileImportService，所以需要保留
    this.importService = new FileImportService(knowledgeLibraryService, this.documentService)
    this.register()
  }

  protected getChannelPrefix(): string {
    return 'file-import'
  }

  /**
   * 导入文件或目录到指定知识库
   */
  async handleImport(
    _event: IpcMainInvokeEvent,
    knowledgeBaseId: number,
    paths: string[],
    options?: FileImportOptions
  ) {
    logger.info('[FileImportIPC] handleImport called', {
      knowledgeBaseId,
      pathsCount: paths?.length,
      paths,
      options
    })

    try {
      if (!Array.isArray(paths) || paths.length === 0) {
        logger.warn('[FileImportIPC] No paths provided')
        return { success: false, error: 'No paths provided' }
      }

      logger.info('[FileImportIPC] Calling importService.importIntoKnowledgeBase')
      const result = await this.importService.importIntoKnowledgeBase(knowledgeBaseId, paths, options)
      logger.info('[FileImportIPC] Import completed', {
        totalInput: result.totalInput,
        imported: result.imported,
        failed: result.failed
      })
      return { success: true, data: result }
    } catch (error) {
      logger.error('[FileImportIPC] Import failed', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

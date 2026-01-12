import { IpcMainInvokeEvent } from 'electron'
import { BaseIPCHandler } from './base-handler'
import { KnowledgeLibraryService } from '../services/knowledgeBase-library'
import { DocumentService } from '../services/knowledgeBase-library/document-service'
import { FileScannerService } from '../services/knowledgeBase-library/file-scanner-service'

/**
 * 文件操作 IPC 处理器
 */
export class FileIPCHandler extends BaseIPCHandler {
  private documentService: DocumentService
  private fileScannerService: FileScannerService

  constructor(private knowledgeLibraryService: KnowledgeLibraryService) {
    super()
    this.documentService = new DocumentService()
    this.fileScannerService = new FileScannerService()
    this.register()
  }

  protected getChannelPrefix(): string {
    return 'file'
  }

  /**
   * 获取指定知识库的所有文件
   */
  async handleGetall(_event: IpcMainInvokeEvent, knowledgeBaseId: number) {
    try {
      // 获取知识库元数据
      const knowledgeBase = await this.knowledgeLibraryService.getById(knowledgeBaseId)
      
      if (!knowledgeBase) {
        return {
          success: false,
          error: `Knowledge base with id ${knowledgeBaseId} not found`
        }
      }

      // 检查是否有文档目录
      if (!knowledgeBase.documentPath) {
        return {
          success: true,
          data: []
        }
      }

      // 获取完整目录路径
      const directoryPath = this.documentService.getFullDirectoryPath(
        knowledgeBase.documentPath
      )

      // 扫描目录
      const files = await this.fileScannerService.scanDirectory(directoryPath)

      return {
        success: true,
        data: files
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 扫描指定知识库的文档目录
   */
  async handleScandirectory(_event: IpcMainInvokeEvent, knowledgeBaseId: number) {
    try {
      // 获取知识库元数据
      const knowledgeBase = await this.knowledgeLibraryService.getById(knowledgeBaseId)
      
      if (!knowledgeBase) {
        return {
          success: false,
          error: `Knowledge base with id ${knowledgeBaseId} not found`
        }
      }

      // 检查是否有文档目录
      if (!knowledgeBase.documentPath) {
        return {
          success: true,
          data: []
        }
      }

      // 获取完整目录路径
      const directoryPath = this.documentService.getFullDirectoryPath(
        knowledgeBase.documentPath
      )

      // 扫描目录
      const files = await this.fileScannerService.scanDirectory(directoryPath)

      // 更新知识库的文档数量
      await this.knowledgeLibraryService.update(knowledgeBaseId, {
        docCount: files.length
      })

      return {
        success: true,
        data: files
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

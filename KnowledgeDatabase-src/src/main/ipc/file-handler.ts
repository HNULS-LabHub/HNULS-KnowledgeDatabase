import { IpcMainInvokeEvent } from 'electron'
import { BaseIPCHandler } from './base-handler'
import { KnowledgeLibraryService } from '../services/knowledgeBase-library'
import { DocumentService } from '../services/knowledgeBase-library/document-service'
import { FileScannerService } from '../services/knowledgeBase-library/file-scanner-service'
import { FileMoveService } from '../services/knowledgeBase-library/file-move-service'
import { KnowledgeConfigService } from '../services/knowledgeBase-library/knowledge-config-service'
import type { QueryService } from '../services/surrealdb-service/query-service'

/**
 * 文件操作 IPC 处理器
 */
export class FileIPCHandler extends BaseIPCHandler {
  private documentService: DocumentService
  private fileScannerService: FileScannerService
  private fileMoveService: FileMoveService
  private knowledgeConfigService: KnowledgeConfigService

  constructor(
    private knowledgeLibraryService: KnowledgeLibraryService,
    queryService?: QueryService
  ) {
    super()
    this.documentService = new DocumentService()
    this.fileScannerService = new FileScannerService(queryService)
    this.knowledgeConfigService = new KnowledgeConfigService()
    this.fileMoveService = new FileMoveService(
      knowledgeLibraryService,
      this.documentService,
      this.knowledgeConfigService
    )
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

      // 确保目录存在（如果被手动删除，自动重新创建）
      await this.documentService.ensureKnowledgeBaseDirectory(knowledgeBase.documentPath)

      // 获取完整目录路径
      const directoryPath = this.documentService.getFullDirectoryPath(knowledgeBase.documentPath)

      // 扫描目录（传入 databaseName 以查询嵌入状态）
      const files = await this.fileScannerService.scanDirectory(
        directoryPath,
        knowledgeBase.databaseName
      )

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

      // 确保目录存在（如果被手动删除，自动重新创建）
      await this.documentService.ensureKnowledgeBaseDirectory(knowledgeBase.documentPath)

      // 获取完整目录路径
      const directoryPath = this.documentService.getFullDirectoryPath(knowledgeBase.documentPath)

      // 扫描目录（传入 databaseName 以查询嵌入状态）
      const files = await this.fileScannerService.scanDirectory(
        directoryPath,
        knowledgeBase.databaseName
      )

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

  /**
   * 移动文件/目录到新位置
   */
  async handleMovefile(
    _event: IpcMainInvokeEvent,
    knowledgeBaseId: number,
    sourcePath: string,
    targetPath: string,
    conflictPolicy: 'rename' | 'skip' | 'overwrite' = 'rename'
  ) {
    try {
      const result = await this.fileMoveService.moveFileOrDirectory(
        knowledgeBaseId,
        sourcePath,
        targetPath,
        conflictPolicy
      )

      return {
        success: result.success,
        data: result.success ? { newPath: result.newPath } : undefined,
        error: result.error
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 批量移动文件/目录
   */
  async handleMovemultiple(
    _event: IpcMainInvokeEvent,
    knowledgeBaseId: number,
    moves: Array<{ source: string; target: string }>,
    conflictPolicy: 'rename' | 'skip' | 'overwrite' = 'rename'
  ) {
    try {
      const result = await this.fileMoveService.moveMultiple(knowledgeBaseId, moves, conflictPolicy)

      return {
        success: true,
        data: result
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 删除文件/目录
   */
  async handleDeletefile(_event: IpcMainInvokeEvent, knowledgeBaseId: number, filePath: string) {
    try {
      const result = await this.fileMoveService.deleteFileOrDirectory(knowledgeBaseId, filePath)

      return {
        success: result.success,
        error: result.error
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

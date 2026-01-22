import { IpcMainInvokeEvent } from 'electron'
import { BaseIPCHandler } from './base-handler'
import { KnowledgeLibraryService } from '../services/knowledgeBase-library'
import { KnowledgeConfigService } from '../services/knowledgeBase-library/knowledge-config-service'
import { DocumentService } from '../services/knowledgeBase-library/document-service'
import type {
  KnowledgeGlobalConfig,
  DocumentConfig
} from '../../preload/types/knowledge-config.types'

/**
 * 知识库配置 IPC 处理器
 */
export class KnowledgeConfigIPCHandler extends BaseIPCHandler {
  private knowledgeConfigService: KnowledgeConfigService
  private documentService: DocumentService

  constructor(private knowledgeLibraryService: KnowledgeLibraryService) {
    super()
    this.knowledgeConfigService = new KnowledgeConfigService()
    this.documentService = new DocumentService()
    this.register()
  }

  protected getChannelPrefix(): string {
    return 'knowledgeConfig'
  }

  /**
   * 获取知识库配置
   */
  async handleGetconfig(_event: IpcMainInvokeEvent, knowledgeBaseId: number) {
    try {
      const kb = await this.knowledgeLibraryService.getById(knowledgeBaseId)
      if (!kb || !kb.documentPath) {
        return {
          success: false,
          error: `Knowledge base ${knowledgeBaseId} not found or missing documentPath`
        }
      }

      await this.documentService.ensureKnowledgeBaseDirectory(kb.documentPath)
      const basePath = this.documentService.getFullDirectoryPath(kb.documentPath)

      const config = await this.knowledgeConfigService.readConfig(basePath)

      return {
        success: true,
        data: config
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 更新全局配置
   */
  async handleUpdateglobalconfig(
    _event: IpcMainInvokeEvent,
    knowledgeBaseId: number,
    globalConfig: Partial<KnowledgeGlobalConfig>
  ) {
    try {
      const kb = await this.knowledgeLibraryService.getById(knowledgeBaseId)
      if (!kb || !kb.documentPath) {
        return {
          success: false,
          error: `Knowledge base ${knowledgeBaseId} not found or missing documentPath`
        }
      }

      await this.documentService.ensureKnowledgeBaseDirectory(kb.documentPath)
      const basePath = this.documentService.getFullDirectoryPath(kb.documentPath)

      const config = await this.knowledgeConfigService.updateGlobalConfig(basePath, globalConfig)

      return {
        success: true,
        data: config
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 获取文档配置（已合并全局配置）
   */
  async handleGetdocumentconfig(
    _event: IpcMainInvokeEvent,
    knowledgeBaseId: number,
    fileKey: string
  ) {
    try {
      const kb = await this.knowledgeLibraryService.getById(knowledgeBaseId)
      if (!kb || !kb.documentPath) {
        return {
          success: false,
          error: `Knowledge base ${knowledgeBaseId} not found or missing documentPath`
        }
      }

      await this.documentService.ensureKnowledgeBaseDirectory(kb.documentPath)
      const basePath = this.documentService.getFullDirectoryPath(kb.documentPath)

      const config = await this.knowledgeConfigService.getDocumentConfig(basePath, fileKey)

      return {
        success: true,
        data: config
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 更新文档配置
   */
  async handleUpdatedocumentconfig(
    _event: IpcMainInvokeEvent,
    knowledgeBaseId: number,
    fileKey: string,
    docConfig: DocumentConfig
  ) {
    try {
      const kb = await this.knowledgeLibraryService.getById(knowledgeBaseId)
      if (!kb || !kb.documentPath) {
        return {
          success: false,
          error: `Knowledge base ${knowledgeBaseId} not found or missing documentPath`
        }
      }

      await this.documentService.ensureKnowledgeBaseDirectory(kb.documentPath)
      const basePath = this.documentService.getFullDirectoryPath(kb.documentPath)

      const config = await this.knowledgeConfigService.updateDocumentConfig(
        basePath,
        fileKey,
        docConfig
      )

      return {
        success: true,
        data: config
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 清除文档配置（回正）
   */
  async handleCleardocumentconfig(
    _event: IpcMainInvokeEvent,
    knowledgeBaseId: number,
    fileKey: string
  ) {
    try {
      const kb = await this.knowledgeLibraryService.getById(knowledgeBaseId)
      if (!kb || !kb.documentPath) {
        return {
          success: false,
          error: `Knowledge base ${knowledgeBaseId} not found or missing documentPath`
        }
      }

      await this.documentService.ensureKnowledgeBaseDirectory(kb.documentPath)
      const basePath = this.documentService.getFullDirectoryPath(kb.documentPath)

      const config = await this.knowledgeConfigService.clearDocumentConfig(basePath, fileKey)

      return {
        success: true,
        data: config
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 验证并清理配置
   */
  async handleValidateandcleanup(_event: IpcMainInvokeEvent, knowledgeBaseId: number) {
    try {
      const kb = await this.knowledgeLibraryService.getById(knowledgeBaseId)
      if (!kb || !kb.documentPath) {
        return {
          success: false,
          error: `Knowledge base ${knowledgeBaseId} not found or missing documentPath`
        }
      }

      await this.documentService.ensureKnowledgeBaseDirectory(kb.documentPath)
      const basePath = this.documentService.getFullDirectoryPath(kb.documentPath)

      await this.knowledgeConfigService.validateAndCleanupConfig(basePath)

      return {
        success: true
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

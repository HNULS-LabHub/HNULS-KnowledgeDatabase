import { IpcMainInvokeEvent, webContents, ipcMain } from 'electron'
import { BaseIPCHandler } from './base-handler'
import { KnowledgeLibraryService } from '../services/knowledgeBase-library'
import { DocumentService } from '../services/knowledgeBase-library/document-service'
import {
  FileImportService,
  FileImportOptions,
  ImportResult
} from '../services/knowledgeBase-library/file-import-service'
import { logger } from '../services/logger'

// 简单的任务ID生成器（不需要额外依赖）
function generateTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 文件导入 IPC 处理器
 */
export class FileImportIPCHandler extends BaseIPCHandler {
  private documentService: DocumentService
  private importService: FileImportService
  private activeTasks = new Map<string, { webContentsId: number }>()

  constructor(private knowledgeLibraryService: KnowledgeLibraryService) {
    super()
    this.documentService = new DocumentService()
    // knowledgeLibraryService 被传递给 FileImportService，所以需要保留
    this.importService = new FileImportService(knowledgeLibraryService, this.documentService)
    this.register()
    // 手动注册异步导入方法（因为方法名包含连字符）
    this.registerAsyncImport()
  }

  protected getChannelPrefix(): string {
    return 'file-import'
  }

  /**
   * 手动注册异步导入方法
   */
  private registerAsyncImport(): void {
    ipcMain.handle('file-import:import-async', async (event, knowledgeBaseId, paths, options) => {
      return await this.handleImportAsync(event, knowledgeBaseId, paths, options)
    })
  }

  /**
   * 异步导入文件或目录到指定知识库（立即返回任务ID，后台处理）
   */
  async handleImportAsync(
    event: IpcMainInvokeEvent,
    knowledgeBaseId: number,
    paths: string[],
    options?: FileImportOptions
  ): Promise<{ success: boolean; data?: { taskId: string }; error?: string }> {
    logger.info('[FileImportIPC] handleImportAsync called', {
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

      // 生成任务ID
      const taskId = generateTaskId()
      const webContentsId = event.sender.id

      // 记录活动任务
      this.activeTasks.set(taskId, { webContentsId })

      // 后台异步执行导入（不阻塞 IPC 响应）
      this.importAsync(taskId, webContentsId, knowledgeBaseId, paths, options).catch((error) => {
        logger.error('[FileImportIPC] Async import failed', { taskId, error })
        const webContentsInstance = webContents.fromId(webContentsId)
        if (webContentsInstance && !webContentsInstance.isDestroyed()) {
          webContentsInstance.send('file-import:error', { taskId, error: error.message })
        }
        this.activeTasks.delete(taskId)
      })

      logger.info('[FileImportIPC] Async import task started', { taskId })
      return { success: true, data: { taskId } }
    } catch (error) {
      logger.error('[FileImportIPC] Failed to start async import', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 后台异步执行导入任务
   */
  private async importAsync(
    taskId: string,
    webContentsId: number,
    knowledgeBaseId: number,
    paths: string[],
    options?: FileImportOptions
  ): Promise<void> {
    const webContentsInstance = webContents.fromId(webContentsId)
    if (!webContentsInstance || webContentsInstance.isDestroyed()) {
      logger.warn('[FileImportIPC] WebContents destroyed, aborting import', { taskId })
      return
    }

    try {
      logger.info('[FileImportIPC] Starting async import', { taskId })

      // 执行导入，带进度回调
      const result = await this.importService.importIntoKnowledgeBase(
        knowledgeBaseId,
        paths,
        options,
        (progress) => {
          // 发送进度更新
          if (!webContentsInstance.isDestroyed()) {
            webContentsInstance.send('file-import:progress', {
              taskId,
              ...progress
            })
          }
        }
      )

      // 发送完成通知
      if (!webContentsInstance.isDestroyed()) {
        webContentsInstance.send('file-import:complete', { taskId, result })
      }

      logger.info('[FileImportIPC] Async import completed', {
        taskId,
        totalInput: result.totalInput,
        imported: result.imported,
        failed: result.failed
      })
    } catch (error) {
      logger.error('[FileImportIPC] Async import error', { taskId, error })
      if (!webContentsInstance.isDestroyed()) {
        webContentsInstance.send('file-import:error', {
          taskId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
      throw error
    } finally {
      this.activeTasks.delete(taskId)
    }
  }

  /**
   * 同步导入文件或目录到指定知识库（保留向后兼容）
   */
  async handleImport(
    _event: IpcMainInvokeEvent,
    knowledgeBaseId: number,
    paths: string[],
    options?: FileImportOptions
  ): Promise<{ success: boolean; data?: ImportResult; error?: string }> {
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
      const result = await this.importService.importIntoKnowledgeBase(
        knowledgeBaseId,
        paths,
        options
      )
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

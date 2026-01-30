import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { WindowService } from './window-service'
import { SurrealDBService } from '../surrealdb-service'
import { DocumentService } from '../knowledgeBase-library/document-service'
import { KnowledgeLibraryService } from '../knowledgeBase-library/knowledge-library-service'
import { embeddingEngineBridge } from '../embedding-engine-bridge'
import { logger } from '../logger'

export class AppService {
  private windowService: WindowService
  private surrealDBService: SurrealDBService
  private documentService: DocumentService
  private knowledgeLibraryService: KnowledgeLibraryService

  constructor() {
    this.windowService = new WindowService()
    this.surrealDBService = new SurrealDBService()
    this.documentService = new DocumentService()
    // KnowledgeLibraryService 需要 QueryService，稍后注入
    this.knowledgeLibraryService = new KnowledgeLibraryService()
  }

  async initialize(): Promise<void> {
    await app.whenReady()

    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron')

    // Default open or close DevTools by F12 in development
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    // Initialize documents directory
    try {
      logger.info('Initializing documents directory...')
      await this.documentService.initializeDocumentsDirectory()
      logger.info('Documents directory initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize documents directory', error)
      // Continue app initialization even if directory initialization fails
    }

    // Initialize and start SurrealDB service
    try {
      logger.info('Initializing SurrealDB service...')
      await this.surrealDBService.initialize()
      await this.surrealDBService.start()
      logger.info('SurrealDB service started successfully')

      // 🎯 注入 QueryService 到 KnowledgeLibraryService
      const queryService = this.surrealDBService.getQueryService()
      this.knowledgeLibraryService.setQueryService(queryService)
      logger.info('QueryService injected into KnowledgeLibraryService')

      embeddingEngineBridge.setQueryService(queryService)
      embeddingEngineBridge.setKnowledgeLibraryService(this.knowledgeLibraryService)
      embeddingEngineBridge.setDocumentService(this.documentService)
      logger.info('QueryService injected into EmbeddingEngineBridge')

      // 🎯 恢复知识库数据库（用于数据库删除后的重建场景）
      try {
        logger.info('Restoring knowledge base databases...')
        const restoreResult = await this.knowledgeLibraryService.restoreKnowledgeBaseDatabases()

        if (restoreResult.restored.length > 0) {
          logger.info(
            `Restored ${restoreResult.restored.length} knowledge base databases: ${restoreResult.restored.join(', ')}`
          )
        }

        if (restoreResult.failed.length > 0) {
          logger.error(
            `Failed to restore ${restoreResult.failed.length} knowledge base databases`,
            restoreResult.failed
          )
        }
      } catch (error) {
        logger.error('Knowledge base database restoration failed:', error)
        // Continue app initialization even if restoration fails
      }
    } catch (error) {
      logger.error('Failed to start SurrealDB service', error)
      // Continue app initialization even if DB fails
    }

    // Cleanup orphaned knowledge base directories
    try {
      logger.info('Cleaning up orphaned knowledge base directories...')
      const cleanupResult = await this.knowledgeLibraryService.cleanupOrphanedDirectories()

      if (cleanupResult.removed.length > 0) {
        logger.warn(
          `Cleaned up ${cleanupResult.removed.length} orphaned directories: ${cleanupResult.removed.join(', ')}`
        )
      }

      if (cleanupResult.failed.length > 0) {
        logger.error(`Failed to cleanup ${cleanupResult.failed.length} directories`)
      }

      logger.info(
        `Directory cleanup completed: scanned ${cleanupResult.scanned} directories, removed ${cleanupResult.removed.length}`
      )
    } catch (error) {
      logger.error('Orphaned directory cleanup failed:', error)
      // Continue app initialization even if cleanup fails
    }

    // Create main window
    this.windowService.createMainWindow()

    this.setupAppEvents()
  }

  private setupAppEvents(): void {
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) {
        this.windowService.createMainWindow()
      }
    })

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit()
      }
    })

    // Graceful shutdown
    app.on('before-quit', async (event) => {
      event.preventDefault()
      logger.info('App is quitting, shutting down SurrealDB service...')

      try {
        await this.surrealDBService.shutdown()
        logger.info('SurrealDB service shut down successfully')
      } catch (error) {
        logger.error('Error shutting down SurrealDB service', error)
      } finally {
        app.exit(0)
      }
    })
  }

  getWindowService(): WindowService {
    return this.windowService
  }

  getSurrealDBService(): SurrealDBService {
    return this.surrealDBService
  }

  getKnowledgeLibraryService(): KnowledgeLibraryService {
    return this.knowledgeLibraryService
  }
}

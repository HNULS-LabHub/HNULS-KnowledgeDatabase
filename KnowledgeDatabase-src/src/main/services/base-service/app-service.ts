import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { WindowService } from './window-service'
import { SurrealDBService } from '../surrealdb-service'
import { DocumentService } from '../knowledgeBase-library/document-service'
import { logger } from '../logger'

export class AppService {
  private windowService: WindowService
  private surrealDBService: SurrealDBService
  private documentService: DocumentService

  constructor() {
    this.windowService = new WindowService()
    this.surrealDBService = new SurrealDBService()
    this.documentService = new DocumentService()
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
    } catch (error) {
      logger.error('Failed to start SurrealDB service', error)
      // Continue app initialization even if DB fails
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
}

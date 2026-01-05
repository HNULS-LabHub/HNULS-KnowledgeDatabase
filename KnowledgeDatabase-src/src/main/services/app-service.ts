import { app, BrowserWindow } from 'electron';
import { electronApp, optimizer } from '@electron-toolkit/utils';
import { WindowService } from './window-service';

export class AppService {
  private windowService: WindowService;

  constructor() {
    this.windowService = new WindowService();
  }

  async initialize(): Promise<void> {
    await app.whenReady();
    
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron');

    // Default open or close DevTools by F12 in development
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    // Create main window
    this.windowService.createMainWindow();

    this.setupAppEvents();
  }

  private setupAppEvents(): void {
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) {
        this.windowService.createMainWindow();
      }
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
  }

  getWindowService(): WindowService {
    return this.windowService;
  }
}
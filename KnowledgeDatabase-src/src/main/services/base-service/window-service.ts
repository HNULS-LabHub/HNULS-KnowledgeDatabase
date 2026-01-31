import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

export class WindowService {
  private mainWindow: BrowserWindow | null = null

  createMainWindow(): BrowserWindow {
    // Create the browser window.
    this.mainWindow = new BrowserWindow({
      width: 900,
      height: 670,
      show: false,
      autoHideMenuBar: true,
      ...(process.platform === 'linux'
        ? {
            icon: join(__dirname, '../../../resources/icon.png')
          }
        : {}),
      ...(process.platform === 'win32'
        ? {
            titleBarOverlay: {
              color: '#ffffff',
              symbolColor: '#000000'
            }
          }
        : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    this.setupWindowEvents()
    this.loadContent()

    return this.mainWindow
  }

  private setupWindowEvents(): void {
    if (!this.mainWindow) return

    this.mainWindow.on('ready-to-show', () => {
      this.mainWindow?.show()
    })

    this.mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    // 允许生产环境也能打开 DevTools（用于调试）
    this.mainWindow.webContents.on('before-input-event', (event, input) => {
      // Ctrl+Shift+I 或 F12 打开 DevTools
      if ((input.control && input.shift && input.key === 'I') || input.key === 'F12') {
        this.mainWindow?.webContents.toggleDevTools()
        event.preventDefault()
      }
    })
  }

  private loadContent(): void {
    if (!this.mainWindow) return

    // HMR for renderer base on electron-vite cli.
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      this.mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow
  }

  closeMainWindow(): void {
    if (this.mainWindow) {
      this.mainWindow.close()
      this.mainWindow = null
    }
  }
}

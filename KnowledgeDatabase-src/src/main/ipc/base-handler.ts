import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';

export abstract class BaseIPCHandler {
  protected abstract getChannelPrefix(): string;

  protected register(): void {
    const methods = this.getHandlerMethods();
    methods.forEach(method => {
      const channel = `${this.getChannelPrefix()}:${method}`;
      ipcMain.handle(channel, this.createHandler(method));
    });
  }

  private getHandlerMethods(): string[] {
    const methods: string[] = [];
    const prototype = Object.getPrototypeOf(this);
    
    Object.getOwnPropertyNames(prototype).forEach(name => {
      if (name !== 'constructor' && 
          name !== 'register' && 
          name !== 'getChannelPrefix' &&
          typeof prototype[name] === 'function' &&
          name.startsWith('handle')) {
        // 将 handleReadFile 转换为 readFile
        const methodName = name.replace(/^handle/, '').toLowerCase();
        methods.push(methodName);
      }
    });

    return methods;
  }

  private createHandler(method: string) {
    return async (event: IpcMainInvokeEvent, ...args: any[]) => {
      try {
        const handlerName = `handle${method.charAt(0).toUpperCase() + method.slice(1)}`;
        const handler = (this as any)[handlerName];
        
        if (typeof handler === 'function') {
          return await handler.call(this, event, ...args);
        } else {
          throw new Error(`Handler method ${handlerName} not found`);
        }
      } catch (error) {
        console.error(`IPC Error in ${this.getChannelPrefix()}:${method}:`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    };
  }

  protected broadcastToAll(channel: string, data: any): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send(channel, data);
    });
  }

  protected sendToWindow(windowId: number, channel: string, data: any): void {
    const window = BrowserWindow.fromId(windowId);
    if (window) {
      window.webContents.send(channel, data);
    }
  }
}
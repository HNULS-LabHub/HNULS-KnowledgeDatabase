import { TestIPCHandler } from './test-handler';

export class IPCManager {
  private handlers: any[] = [];

  initialize(): void {
    // 注册所有 IPC 处理器
    this.handlers.push(new TestIPCHandler());
    
    // TODO: 添加其他处理器
    // this.handlers.push(new FileIPCHandler(fileService));
    // this.handlers.push(new DatabaseIPCHandler(databaseService));
    
    console.log(`Registered ${this.handlers.length} IPC handlers`);
  }

  cleanup(): void {
    // 清理资源（如果需要）
    this.handlers.length = 0;
  }
}
import { AppService } from './services'
import { IPCManager } from './ipc'

class Application {
  private appService: AppService
  private ipcManager: IPCManager

  constructor() {
    this.appService = new AppService()
    this.ipcManager = new IPCManager()
  }

  async start(): Promise<void> {
    try {
      // 初始化应用服务
      await this.appService.initialize()

      // 初始化 IPC 处理器（传入 SurrealDBService）
      this.ipcManager.initialize(this.appService.getSurrealDBService())

      console.log('Application started successfully')
    } catch (error) {
      console.error('Failed to start application:', error)
      process.exit(1)
    }
  }

  async shutdown(): Promise<void> {
    try {
      this.ipcManager.cleanup()
      console.log('Application shutdown completed')
    } catch (error) {
      console.error('Error during shutdown:', error)
    }
  }
}

// 创建应用实例
const application = new Application()

// 启动应用
application.start()

// 处理应用退出
process.on('before-exit', () => {
  application.shutdown()
})

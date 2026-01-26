import { AppService } from './services'
import { IPCManager } from './ipc'
import { globalMonitorBridge } from './services/global-monitor-bridge'
import { embeddingEngineBridge } from './services/embedding-engine-bridge'
import { logServiceDiagnostics } from './services/logger'

// Windows: 强制 Node 控制台使用 UTF-8，避免中文日志乱码
try {
  if (process.platform === 'win32') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { execSync } = require('child_process')
    execSync('chcp 65001', { stdio: 'ignore' })
    process.env.LANG = 'zh_CN.UTF-8'
  }
} catch {
  // ignore
}

class Application {
  private appService: AppService
  private ipcManager: IPCManager

  constructor() {
    this.appService = new AppService()
    this.ipcManager = new IPCManager()
  }

  async start(): Promise<void> {
    try {
      // 初始化应用服务（包含 app.whenReady()）
      await this.appService.initialize()

      // 启动全局监控服务（Utility Process）- 必须在 app ready 之后
      await globalMonitorBridge.start()

      // 启动嵌入引擎（Utility Process）
      await embeddingEngineBridge.start()

      // 初始化 IPC 处理器（传入 SurrealDBService 和 KnowledgeLibraryService）
      this.ipcManager.initialize(
        this.appService.getSurrealDBService(),
        this.appService.getKnowledgeLibraryService()
      )

      // 打印服务诊断报告（用于调试依赖注入问题）
      logServiceDiagnostics()

      console.log('Application started successfully')
    } catch (error) {
      console.error('Failed to start application:', error)
      process.exit(1)
    }
  }

  async shutdown(): Promise<void> {
    try {
      this.ipcManager.cleanup()
      embeddingEngineBridge.stop()
      globalMonitorBridge.stop()
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

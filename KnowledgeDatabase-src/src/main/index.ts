import { AppService, UserConfigService, ModelConfigService } from './services'
import { IPCManager } from './ipc'
import { globalMonitorBridge } from './services/global-monitor-bridge'
import { embeddingEngineBridge } from './services/embedding-engine-bridge'
import { vectorIndexerBridge } from './services/vector-indexer-bridge'
import { apiServerBridge } from './services/api-server-bridge'
import { knowledgeGraphBridge } from './services/knowledge-graph-bridge'
import { VectorRetrievalService } from './services/vector-retrieval'
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

      // ❗ 关键：在窗口显示前先注册 IPC handlers，避免渲染进程请求时 handler 未就绪
      this.ipcManager.initialize(
        this.appService.getSurrealDBService(),
        this.appService.getKnowledgeLibraryService(),
        this.appService.getKgMonitorService()
      )

      // 启动全局监控服务（Utility Process）- 必须在 app ready 之后
      await globalMonitorBridge.start()

      // 启动嵌入引擎（Utility Process）
      await embeddingEngineBridge.start()

      // 启动向量索引器（Utility Process）
      await this.startVectorIndexer()

      // 启动 API 服务器（Utility Process）
      await this.startApiServer()

      // 启动知识图谱子进程（Utility Process）
      await this.startKnowledgeGraph()

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
      apiServerBridge.kill()
      knowledgeGraphBridge.stop()
      vectorIndexerBridge.kill()
      embeddingEngineBridge.stop()
      globalMonitorBridge.stop()
      console.log('Application shutdown completed')
    } catch (error) {
      console.error('Error during shutdown:', error)
    }
  }

  /**
   * 启动向量索引器
   */
  private async startVectorIndexer(): Promise<void> {
    try {
      const surrealDBService = this.appService.getSurrealDBService()
      const queryService = surrealDBService.getQueryService()

      // 获取数据库连接配置（getServerUrl 已返回 WebSocket URL）
      const serverUrl = surrealDBService.getServerUrl()
      const credentials = surrealDBService.getCredentials()

      // 启动 utility process
      await vectorIndexerBridge.spawn()

      // 设置依赖
      vectorIndexerBridge.setQueryService(queryService)
      vectorIndexerBridge.setKnowledgeLibraryService(this.appService.getKnowledgeLibraryService())
      vectorIndexerBridge.setDBConnectionConfig({
        serverUrl,
        username: credentials.username,
        password: credentials.password,
        namespace: 'knowledge'
      })

      // 读取用户配置的 batchSize
      const userConfigService = new UserConfigService()
      const userConfig = await userConfigService.getConfig()
      const batchSize = userConfig.embedding.hnswBatchSize

      // 启动索引循环（传入用户配置）
      await vectorIndexerBridge.startIndexer({ batchSize })

      // 监听事件（可选：用于日志记录）
      vectorIndexerBridge.onBatchCompleted(({ tableName, count, duration }) => {
        console.log(`[VectorIndexer] Transferred ${count} records to ${tableName} in ${duration}ms`)
      })

      vectorIndexerBridge.onError(({ message, details }) => {
        console.error(`[VectorIndexer] Error: ${message}`, details)
      })

      console.log('Vector Indexer started successfully')
    } catch (error) {
      console.error('Failed to start Vector Indexer:', error)
      // 不阻止应用启动，索引器是可选功能
    }
  }

  /**
   * 启动 API 服务器
   */
  private async startApiServer(): Promise<void> {
    try {
      const surrealDBService = this.appService.getSurrealDBService()
      const knowledgeLibraryService = this.appService.getKnowledgeLibraryService()

      // 获取数据库连接配置
      const serverUrl = surrealDBService.getServerUrl()
      const credentials = surrealDBService.getCredentials()

      // 注入向量检索服务（供 Utility 进程 REST API 使用）
      const vectorRetrievalService = new VectorRetrievalService(
        surrealDBService,
        knowledgeLibraryService
      )
      apiServerBridge.setVectorRetrievalService(vectorRetrievalService)

      // 启动 utility process
      await apiServerBridge.spawn()

      // 启动 HTTP 服务器
      await apiServerBridge.startServer({
        config: {
          port: 3721,
          host: '0.0.0.0'
        },
        dbConfig: {
          serverUrl,
          username: credentials.username,
          password: credentials.password,
          namespace: 'knowledge'
        },
        metaFilePath: knowledgeLibraryService.getMetaFilePath()
      })

      // 监听事件
      apiServerBridge.onStarted((port, host) => {
        console.log(`[ApiServer] HTTP server started on http://${host}:${port}`)
      })

      apiServerBridge.onError((message, details) => {
        console.error(`[ApiServer] Error: ${message}`, details)
      })

      console.log('API Server started successfully')
    } catch (error) {
      console.error('Failed to start API Server:', error)
      // 不阻止应用启动，API 服务器是可选功能
    }
  }

  /**
   * 启动知识图谱子进程
   */
  private async startKnowledgeGraph(): Promise<void> {
    try {
      const surrealDBService = this.appService.getSurrealDBService()
      const serverUrl = surrealDBService.getServerUrl()
      const credentials = surrealDBService.getCredentials()

      // 启动 utility process
      await knowledgeGraphBridge.start()

      // 初始化数据库连接（子进程自己连 system 库）
      await knowledgeGraphBridge.initialize({
        serverUrl,
        username: credentials.username,
        password: credentials.password,
        namespace: 'knowledge',
        database: 'system'
      })

      // 读取用户配置的并行数
      const userConfigService = new UserConfigService()
      const userConfig = await userConfigService.getConfig()
      knowledgeGraphBridge.updateConcurrency(userConfig.knowledgeGraph.chunkConcurrency)

      // 同步模型提供商配置到 KG 子进程
      try {
        const modelConfigService = new ModelConfigService()
        const modelConfig = await modelConfigService.getConfig()
        knowledgeGraphBridge.updateModelProviders(
          (modelConfig.providers ?? []).map((p) => ({
            id: p.id,
            protocol: p.protocol,
            baseUrl: p.baseUrl,
            apiKey: p.apiKey,
            enabled: p.enabled
          }))
        )
      } catch {
        // ignore provider sync errors on startup
      }

      // 监听事件
      knowledgeGraphBridge.onTaskCompleted((taskId) => {
        console.log(`[KnowledgeGraph] Task completed: ${taskId}`)
      })

      knowledgeGraphBridge.onTaskFailed((taskId, error) => {
        console.error(`[KnowledgeGraph] Task failed: ${taskId}`, error)
      })

      console.log('Knowledge Graph process started successfully')
    } catch (error) {
      console.error('Failed to start Knowledge Graph process:', error)
      // 不阻止应用启动，知识图谱是可选功能
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

import { TestIPCHandler } from './test-handler'
import { DatabaseIPCHandler } from './database-handler'
import { KnowledgeLibraryIPCHandler } from './knowledge-library-handler'
import { FileIPCHandler } from './file-handler'
import { FileImportIPCHandler } from './file-import-handler'
import { UserConfigIPCHandler } from './user-config-handler'
import { MinerUIPCHandler } from './mineru-handler'
import { ChunkingIPCHandler } from './chunking-handler'
import { ModelConfigIPCHandler } from './model-config-handler'
import { KnowledgeConfigIPCHandler } from './knowledge-config-handler'
import { TaskMonitorIPCHandler } from './task-monitor-handler'
import { KgMonitorIPCHandler } from './kg-monitor-handler'
import { EmbeddingIPCHandler } from './embedding-handler'
import { VectorRetrievalIPCHandler } from './vector-retrieval-handler'
import { AgentIPCHandler } from './agent-handler'
import {
  registerVectorIndexerHandlers,
  unregisterVectorIndexerHandlers
} from './vector-indexer-handler'
import {
  registerKnowledgeGraphHandlers,
  unregisterKnowledgeGraphHandlers
} from './knowledge-graph-handler'
import { SurrealDBService } from '../services/surrealdb-service'
import { KnowledgeLibraryService } from '../services/knowledgeBase-library'
import { KgMonitorService } from '../services/knowledge-graph-monitor/kg-monitor-service'
import { UserConfigService } from '../services/user-config-service'
import { MinerUParserService } from '../services/mineru-parser'
import { ChunkingService } from '../services/chunking'
import { ModelConfigService } from '../services/model-config'
import { VectorRetrievalService } from '../services/vector-retrieval'

export class IPCManager {
  private handlers: any[] = []

  initialize(
    surrealDBService: SurrealDBService,
    knowledgeLibraryService: KnowledgeLibraryService,
    kgMonitorService: KgMonitorService
  ): void {
    // 注册模型配置处理器（需要先创建，供其他 handler 使用）
    const modelConfigService = new ModelConfigService()
    this.handlers.push(new ModelConfigIPCHandler(modelConfigService))

    // 注册测试处理器（传入 modelConfigService 以支持 LLM 调用）
    this.handlers.push(new TestIPCHandler(modelConfigService))

    // 注册数据库处理器
    this.handlers.push(new DatabaseIPCHandler(surrealDBService))

    // 使用传入的 KnowledgeLibraryService（已注入 QueryService）
    this.handlers.push(new KnowledgeLibraryIPCHandler(knowledgeLibraryService))

    // 注册文件处理器（传入 QueryService 以支持嵌入信息查询）
    const queryService = surrealDBService.getQueryService()
    this.handlers.push(new FileIPCHandler(knowledgeLibraryService, queryService))

    // 注册文件导入处理器
    this.handlers.push(new FileImportIPCHandler(knowledgeLibraryService))

    // 注册用户配置处理器
    const userConfigService = new UserConfigService()
    this.handlers.push(new UserConfigIPCHandler(userConfigService))

    // 注册 MinerU 解析处理器
    const minerUParserService = new MinerUParserService()
    minerUParserService.initialize().catch(() => {
      // ignore init errors
    })
    this.handlers.push(new MinerUIPCHandler(minerUParserService))

    // 注册分块处理器
    const chunkingService = new ChunkingService()
    this.handlers.push(new ChunkingIPCHandler(chunkingService))

    // 注册知识库配置处理器
    this.handlers.push(new KnowledgeConfigIPCHandler(knowledgeLibraryService))

    // 注册任务监控处理器
    this.handlers.push(new TaskMonitorIPCHandler())
    // 注册知识图谱监控处理器
    this.handlers.push(new KgMonitorIPCHandler(kgMonitorService))

    // 注册嵌入服务处理器
    this.handlers.push(new EmbeddingIPCHandler())

    // 注册向量召回处理器（RAG 检索入口）
    const vectorRetrievalService = new VectorRetrievalService(
      surrealDBService,
      knowledgeLibraryService
    )
    this.handlers.push(new VectorRetrievalIPCHandler(vectorRetrievalService))

    // 注册 Agent 处理器（LangGraph RAG Agent）
    this.handlers.push(new AgentIPCHandler(vectorRetrievalService, modelConfigService))

    // 注册向量索引器处理器
    registerVectorIndexerHandlers()

    // 注册知识图谱处理器
    registerKnowledgeGraphHandlers()

    console.log(`Registered ${this.handlers.length} IPC handlers`)
  }

  cleanup(): void {
    // 清理向量索引器 handlers
    unregisterVectorIndexerHandlers()
    // 清理知识图谱 handlers
    unregisterKnowledgeGraphHandlers()
    // 清理资源（如果需要）
    this.handlers.length = 0
  }
}

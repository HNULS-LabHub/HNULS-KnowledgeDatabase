import { TestIPCHandler } from './test-handler'
import { DatabaseIPCHandler } from './database-handler'
import { KnowledgeLibraryIPCHandler } from './knowledge-library-handler'
import { SurrealDBService } from '../services/surrealdb-service'
import { KnowledgeLibraryService } from '../services/knowledgeBase-library'

export class IPCManager {
  private handlers: any[] = []

  initialize(surrealDBService?: SurrealDBService): void {
    // 注册所有 IPC 处理器
    this.handlers.push(new TestIPCHandler())

    // 注册数据库处理器
    if (surrealDBService) {
      this.handlers.push(new DatabaseIPCHandler(surrealDBService))
    }

    // 注册知识库元数据处理器
    const knowledgeLibraryService = new KnowledgeLibraryService()
    this.handlers.push(new KnowledgeLibraryIPCHandler(knowledgeLibraryService))

    // TODO: 添加其他处理器
    // this.handlers.push(new FileIPCHandler(fileService));

    console.log(`Registered ${this.handlers.length} IPC handlers`)
  }

  cleanup(): void {
    // 清理资源（如果需要）
    this.handlers.length = 0
  }
}

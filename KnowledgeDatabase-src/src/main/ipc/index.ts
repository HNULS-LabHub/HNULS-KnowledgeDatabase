import { TestIPCHandler } from './test-handler'
import { DatabaseIPCHandler } from './database-handler'
import { KnowledgeLibraryIPCHandler } from './knowledge-library-handler'
import { FileIPCHandler } from './file-handler'
import { FileImportIPCHandler } from './file-import-handler'
import { UserConfigIPCHandler } from './user-config-handler'
import { SurrealDBService } from '../services/surrealdb-service'
import { KnowledgeLibraryService } from '../services/knowledgeBase-library'
import { UserConfigService } from '../services/user-config-service'

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

    // 注册文件处理器
    this.handlers.push(new FileIPCHandler(knowledgeLibraryService))

    // 注册文件导入处理器
    this.handlers.push(new FileImportIPCHandler(knowledgeLibraryService))

    // 注册用户配置处理器
    const userConfigService = new UserConfigService()
    this.handlers.push(new UserConfigIPCHandler(userConfigService))

    console.log(`Registered ${this.handlers.length} IPC handlers`)
  }

  cleanup(): void {
    // 清理资源（如果需要）
    this.handlers.length = 0
  }
}

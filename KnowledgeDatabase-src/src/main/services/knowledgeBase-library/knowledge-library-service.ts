import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import { logger } from '../logger'
import { DocumentService } from './document-service'
import type { QueryService } from '../surrealdb-service'
import type {
  KnowledgeBaseMeta,
  KnowledgeLibraryMeta,
  CreateKnowledgeBaseData,
  UpdateKnowledgeBaseData,
  CleanupResult
} from './types'

/**
 * 知识库元数据服务
 * 负责管理知识库元数据的存储和读取
 */
export class KnowledgeLibraryService {
  private metaFilePath: string
  private readonly defaultVersion = '1.0.0'
  private documentService: DocumentService
  private queryService?: QueryService

  constructor(queryService?: QueryService) {
    // 获取用户数据目录下的 data 目录
    const userDataPath = app.getPath('userData')
    this.metaFilePath = path.join(userDataPath, 'data', 'Knowledge-library-meta.json')
    this.documentService = new DocumentService()
    this.queryService = queryService
  }

  /**
   * 设置 QueryService（用于延迟注入）
   */
  setQueryService(queryService: QueryService): void {
    this.queryService = queryService
    logger.info('QueryService set in KnowledgeLibraryService', {
      isConnected: queryService?.isConnected(),
      hasQueryService: !!this.queryService
    })
  }

  /**
   * 获取元数据文件路径
   */
  getMetaFilePath(): string {
    return this.metaFilePath
  }

  /**
   * 确保元数据文件存在，如果不存在则创建
   */
  private async ensureFileExists(): Promise<void> {
    try {
      await fs.access(this.metaFilePath)
    } catch {
      // 文件不存在，创建默认结构
      const defaultData: KnowledgeLibraryMeta = {
        version: this.defaultVersion,
        knowledgeBases: []
      }
      await this.writeFile(defaultData)
      logger.info(`Created knowledge library meta file: ${this.metaFilePath}`)
    }
  }

  /**
   * 读取元数据文件
   */
  private async readFile(): Promise<KnowledgeLibraryMeta> {
    await this.ensureFileExists()

    try {
      const content = await fs.readFile(this.metaFilePath, 'utf-8')
      const data: KnowledgeLibraryMeta = JSON.parse(content)

      // 验证数据结构
      if (!data.version || !Array.isArray(data.knowledgeBases)) {
        throw new Error('Invalid meta file structure')
      }

      return data
    } catch (error) {
      logger.error('Failed to read knowledge library meta file', error)
      // 如果读取失败，返回默认结构
      return {
        version: this.defaultVersion,
        knowledgeBases: []
      }
    }
  }

  /**
   * 写入元数据文件
   */
  private async writeFile(data: KnowledgeLibraryMeta): Promise<void> {
    try {
      // 确保目录存在
      const dir = path.dirname(this.metaFilePath)
      await fs.mkdir(dir, { recursive: true })

      // 写入文件（使用原子写入，先写入临时文件再重命名）
      const tempPath = `${this.metaFilePath}.tmp`
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8')
      await fs.rename(tempPath, this.metaFilePath)
    } catch (error) {
      logger.error('Failed to write knowledge library meta file', error)
      throw error
    }
  }

  /**
   * 生成新的知识库 ID
   */
  private async generateId(): Promise<number> {
    const data = await this.readFile()
    if (data.knowledgeBases.length === 0) {
      return 1
    }
    const maxId = Math.max(...data.knowledgeBases.map((kb) => kb.id))
    return maxId + 1
  }

  /**
   * 获取所有知识库元数据
   */
  async getAll(): Promise<KnowledgeBaseMeta[]> {
    const data = await this.readFile()
    return data.knowledgeBases
  }

  /**
   * 根据 ID 获取知识库元数据
   */
  async getById(id: number): Promise<KnowledgeBaseMeta | null> {
    const data = await this.readFile()
    const kb = data.knowledgeBases.find((kb) => kb.id === id)
    return kb || null
  }

  /**
   * 创建新知识库
   */
  async create(data: CreateKnowledgeBaseData): Promise<KnowledgeBaseMeta> {
    const meta = await this.readFile()
    const now = new Date().toISOString()

    // 检查知识库名称是否已存在
    const trimmedName = data.name.trim()
    const existingKB = meta.knowledgeBases.find((kb) => kb.name === trimmedName)
    if (existingKB) {
      const error = new Error(`Knowledge base with name "${trimmedName}" already exists`)
      logger.error('Failed to create knowledge base: duplicate name', { name: trimmedName })
      throw error
    }

    // 生成新 ID
    const newId = await this.generateId()

    // 创建文档目录（使用知识库名称）
    const documentPath = await this.documentService.createKnowledgeBaseDirectory(
      newId,
      trimmedName
    )

    // 使用知识库名称作为 database 名称
    const databaseName = trimmedName

    const newKB: KnowledgeBaseMeta = {
      id: newId,
      name: trimmedName,
      description: data.description.trim(),
      docCount: 0,
      chunkCount: 0,
      lastUpdated: now,
      createdAt: now,
      color: data.color,
      icon: data.icon,
      documentPath,
      databaseName
    }

    // 🎯 在 SurrealDB 中创建对应的 database
    logger.debug('Checking QueryService availability', {
      hasQueryService: !!this.queryService,
      isConnected: this.queryService?.isConnected()
    })

    if (this.queryService) {
      try {
        // 在 knowledge namespace 下定义新的 database
        // SurrealDB query() 返回数组，每个元素对应一条语句的结果
        const result = await this.queryService.query<any[]>(`DEFINE DATABASE \`${databaseName}\`;`)
        logger.info(`Created SurrealDB database: ${databaseName}`, {
          result: result?.[0],
          fullResult: result
        })
      } catch (error) {
        logger.error(`Failed to create SurrealDB database for KB ${newId}:`, error)
        // 不阻塞知识库创建，继续执行
      }
    } else {
      logger.warn('QueryService not available, skipping SurrealDB database creation', {
        queryServiceType: typeof this.queryService,
        queryServiceValue: this.queryService
      })
    }

    meta.knowledgeBases.push(newKB)
    await this.writeFile(meta)

    logger.info(`Created knowledge base: ${newKB.name} (ID: ${newKB.id}, DB: ${databaseName})`)
    return newKB
  }

  /**
   * 更新知识库元数据
   */
  async update(id: number, updateData: UpdateKnowledgeBaseData): Promise<KnowledgeBaseMeta | null> {
    const meta = await this.readFile()
    const index = meta.knowledgeBases.findIndex((kb) => kb.id === id)

    if (index === -1) {
      return null
    }

    const updatedKB: KnowledgeBaseMeta = {
      ...meta.knowledgeBases[index],
      ...updateData,
      id, // 确保 ID 不被修改
      lastUpdated: new Date().toISOString()
    }

    meta.knowledgeBases[index] = updatedKB
    await this.writeFile(meta)

    logger.info(`Updated knowledge base: ${updatedKB.name} (ID: ${id})`)
    return updatedKB
  }

  /**
   * 删除知识库
   */
  async delete(id: number): Promise<boolean> {
    const meta = await this.readFile()
    const index = meta.knowledgeBases.findIndex((kb) => kb.id === id)

    if (index === -1) {
      return false
    }

    const deletedKB = meta.knowledgeBases[index]

    // 删除文档目录
    if (deletedKB.documentPath) {
      try {
        await this.documentService.deleteKnowledgeBaseDirectory(deletedKB.documentPath)
      } catch (error) {
        logger.error(`Failed to delete document directory for KB ${id}`, error)
        // 继续删除元数据，即使目录删除失败
      }
    }

    // 🎯 删除 SurrealDB 中对应的 database
    if (this.queryService && deletedKB.databaseName) {
      try {
        const dbName = deletedKB.databaseName
        // SurrealDB query() 返回数组，每个元素对应一条语句的结果
        const result = await this.queryService.query<any[]>(`REMOVE DATABASE \`${dbName}\`;`)
        logger.info(`Removed SurrealDB database: ${dbName}`, {
          result: result?.[0],
          fullResult: result
        })
      } catch (error) {
        logger.error(`Failed to remove SurrealDB database for KB ${id}:`, error)
        // 不阻塞知识库删除，继续执行
      }
    }

    meta.knowledgeBases.splice(index, 1)
    await this.writeFile(meta)

    logger.info(`Deleted knowledge base: ${deletedKB.name} (ID: ${id})`)
    return true
  }

  /**
   * 清理孤立的知识库目录和数据库
   * 扫描 documents/ 目录和 SurrealDB，删除没有对应元数据记录的资源
   */
  async cleanupOrphanedDirectories(): Promise<CleanupResult> {
    const result: CleanupResult = {
      scanned: 0,
      removed: [],
      failed: []
    }

    try {
      // 1. 获取所有知识库元数据
      const knowledgeBases = await this.getAll()
      // 使用 documentPath 作为有效目录名集合
      const validDirNames = new Set(
        knowledgeBases.map((kb) => kb.documentPath).filter((path) => path !== undefined)
      )
      // 使用 databaseName 作为有效数据库名集合
      const validDbNames = new Set(
        knowledgeBases.map((kb) => kb.databaseName).filter((name) => name !== undefined)
      )

      // 2. 清理文件系统的孤立目录
      const userDataPath = app.getPath('userData')
      const documentsPath = path.join(userDataPath, 'data', 'documents')

      // 确保目录存在
      try {
        await fs.mkdir(documentsPath, { recursive: true })
      } catch (error) {
        logger.warn('Documents directory does not exist, skipping filesystem cleanup')
      }

      // 3. 扫描 documents 目录
      try {
        const entries = await fs.readdir(documentsPath, { withFileTypes: true })

        // 4. 检查每个子目录
        for (const entry of entries) {
          if (!entry.isDirectory()) continue

          result.scanned++
          const dirName = entry.name

          // 5. 如果目录名不在有效 documentPath 列表中，则为孤立目录
          if (!validDirNames.has(dirName)) {
            try {
              const dirPath = path.join(documentsPath, dirName)

              logger.warn(`Found orphaned directory: ${dirName}`)

              // 6. 删除孤立目录
              await fs.rm(dirPath, { recursive: true, force: true })

              result.removed.push(dirName)
              logger.info(`Removed orphaned directory: ${dirName}`)
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error)
              logger.error(`Failed to remove orphaned directory ${dirName}:`, error)
              result.failed.push({ id: dirName, error: errorMessage })
            }
          }
        }
      } catch (error) {
        logger.error('Failed to scan documents directory:', error)
      }

      // 7. 清理 SurrealDB 的孤立数据库
      if (this.queryService && this.queryService.isConnected()) {
        try {
          logger.debug('Checking for orphaned SurrealDB databases')

          // 查询当前 namespace 下的所有 database
          const infoResult = await this.queryService.query<any[]>('INFO FOR NS;')
          logger.debug('INFO FOR NS result:', { infoResult, firstResult: infoResult?.[0] })
          
          // 修复：直接访问 infoResult[0]，而不是 infoResult[0].result
          const nsInfo = infoResult?.[0]

          if (nsInfo && nsInfo.databases) {
            logger.debug('Found databases in namespace:', { databases: nsInfo.databases })
            
            // 遍历所有数据库
            for (const dbName in nsInfo.databases) {
              // 跳过 system 数据库
              if (dbName === 'system') continue

              // 检查是否是孤立数据库
              if (!validDbNames.has(dbName)) {
                try {
                  logger.warn(`Found orphaned SurrealDB database: ${dbName}`)

                  // 删除孤立数据库
                  await this.queryService.query(`REMOVE DATABASE \`${dbName}\`;`)

                  result.removed.push(`db:${dbName}`)
                  logger.info(`Removed orphaned SurrealDB database: ${dbName}`)
                } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : String(error)
                  logger.error(`Failed to remove orphaned database ${dbName}:`, error)
                  result.failed.push({ id: `db:${dbName}`, error: errorMessage })
                }
              }
            }
          } else {
            logger.debug('No databases found in namespace info', { nsInfo })
          }
        } catch (error) {
          logger.error('Failed to cleanup orphaned SurrealDB databases:', error)
          // 不抛出错误，继续执行
        }
      } else {
        logger.warn('QueryService not available, skipping SurrealDB database cleanup')
      }

      return result
    } catch (error) {
      logger.error('Failed to cleanup orphaned resources:', error)
      throw error
    }
  }
}

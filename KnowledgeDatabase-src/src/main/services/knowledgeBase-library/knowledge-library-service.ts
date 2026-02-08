import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import { logger } from '../logger'
import { ServiceTracker } from '../logger/service-tracker'
import { DocumentService } from './document-service'
import { FileScannerService } from './file-scanner-service'
import type { QueryService } from '../surrealdb-service'
import { kbDocumentTable } from '../surrealdb-service'
import type {
  KnowledgeBaseMeta,
  KnowledgeLibraryMeta,
  CreateKnowledgeBaseData,
  UpdateKnowledgeBaseData,
  CleanupResult
} from './types'

type FileTypeHint = {
  fileKey: string
  fileName: string
  filePath: string
  fileType: string
}

/**
 * 知识库元数据服务
 * 负责管理知识库元数据的存储和读取
 */
export class KnowledgeLibraryService {
  private metaFilePath: string
  private readonly defaultVersion = '1.0.0'
  private documentService: DocumentService
  private queryService?: QueryService
  private tracker: ServiceTracker

  /**
   * 获取实例 ID（用于追踪）
   */
  getInstanceId(): string {
    return this.tracker.getInstanceId()
  }

  private getNamespace(): string {
    return this.queryService?.getNamespace() || 'knowledge'
  }

  private normalizeFileKey(fileKey: string): string {
    return fileKey.replace(/\\/g, '/')
  }

  private buildFileHints(fileKey: string): FileTypeHint {
    const normalized = this.normalizeFileKey(fileKey)
    const fileName = path.basename(normalized)
    const fileType = path.extname(fileName).slice(1)
    return {
      fileKey: normalized,
      fileName,
      filePath: normalized,
      fileType
    }
  }

  constructor(queryService?: QueryService) {
    this.tracker = new ServiceTracker('KnowledgeLibraryService')
    // 获取用户数据目录下的 data 目录
    const userDataPath = app.getPath('userData')
    this.metaFilePath = path.join(userDataPath, 'data', 'Knowledge-library-meta.json')
    this.documentService = new DocumentService()
    this.queryService = queryService

    if (queryService) {
      this.tracker.trackDependencyInjection('QueryService', queryService)
    }
  }

  /**
   * 设置 QueryService（用于延迟注入）
   */
  setQueryService(queryService: QueryService): void {
    this.queryService = queryService
    this.tracker.trackDependencyInjection('QueryService', queryService)
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
    const documentPath = await this.documentService.createKnowledgeBaseDirectory(newId, trimmedName)

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

        // 初始化知识库数据库的表结构 (只创建 kb_document，embedding 表会在执行 embedding 时动态创建)
        const namespace = this.queryService.getNamespace() || 'knowledge'
        const schemaSql = kbDocumentTable.sql
        try {
          logger.debug(`Initializing KB schema in ${namespace}:${databaseName}`, {
            sql: schemaSql.substring(0, 200) + '...'
          })
          const schemaResult = await this.queryService.queryInDatabase(
            namespace,
            databaseName,
            schemaSql
          )
          logger.info(`Initialized knowledge base schema: ${databaseName}`, {
            result: schemaResult
          })
        } catch (schemaError) {
          logger.error(`Failed to initialize schema for KB ${newId}:`, schemaError)
        }
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

  // ==========================================================================
  // SurrealDB：文件同步（导入/移动/删除）
  // ==========================================================================

  /**
   * 文件导入成功后，创建/更新 kb_document（embedding 状态置为 pending）
   */
  async syncImportedFileToSurrealDB(params: {
    knowledgeBaseId: number
    fileKey: string
  }): Promise<void> {
    if (!this.queryService || !this.queryService.isConnected()) return

    const kb = await this.getById(params.knowledgeBaseId)
    if (!kb?.databaseName) return

    const namespace = this.getNamespace()
    const hints = this.buildFileHints(params.fileKey)

    const sql = `
      UPSERT kb_document SET
        file_key = $fileKey,
        file_name = $fileName,
        file_path = $filePath,
        file_type = $fileType,
        updated_at = time::now()
      WHERE file_key = $fileKey;
    `

    try {
      await this.queryService.queryInDatabase(namespace, kb.databaseName, sql, {
        fileKey: hints.fileKey,
        fileName: hints.fileName,
        filePath: hints.filePath,
        fileType: hints.fileType
      })
    } catch (error) {
      logger.warn('[KnowledgeLibraryService] Failed to sync imported file to SurrealDB', {
        knowledgeBaseId: params.knowledgeBaseId,
        fileKey: params.fileKey,
        error
      })
    }
  }

  /**
   * 文件移动/重命名后，同步更新 kb_document 和 kb_document_embedding 的 file_key
   */
  async syncMovedFileToSurrealDB(params: {
    knowledgeBaseId: number
    oldFileKey: string
    newFileKey: string
  }): Promise<void> {
    if (!this.queryService || !this.queryService.isConnected()) return

    const kb = await this.getById(params.knowledgeBaseId)
    if (!kb?.databaseName) return

    const namespace = this.getNamespace()
    const oldKey = this.normalizeFileKey(params.oldFileKey)
    const hints = this.buildFileHints(params.newFileKey)

    const sql = `
      UPDATE kb_document SET
        file_key = $newFileKey,
        file_name = $fileName,
        file_path = $filePath,
        file_type = $fileType,
        updated_at = time::now()
      WHERE file_key = $oldFileKey;

      UPSERT kb_document SET
        file_key = $newFileKey,
        file_name = $fileName,
        file_path = $filePath,
        file_type = $fileType,
        updated_at = time::now()
      WHERE file_key = $newFileKey;

      -- 🔥 同步更新 kb_document_embedding 关联表的 file_key
      UPDATE kb_document_embedding SET
        file_key = $newFileKey,
        updated_at = time::now()
      WHERE file_key = $oldFileKey;
    `

    try {
      await this.queryService.queryInDatabase(namespace, kb.databaseName, sql, {
        oldFileKey: oldKey,
        newFileKey: hints.fileKey,
        fileName: hints.fileName,
        filePath: hints.filePath,
        fileType: hints.fileType
      })
    } catch (error) {
      logger.warn('[KnowledgeLibraryService] Failed to sync moved file to SurrealDB', {
        knowledgeBaseId: params.knowledgeBaseId,
        oldFileKey: params.oldFileKey,
        newFileKey: params.newFileKey,
        error
      })
    }
  }

  /**
   * 目录移动后，同步更新 prefix 下所有 kb_document 和 kb_document_embedding 的 file_key
   */
  async syncMovedDirectoryToSurrealDB(params: {
    knowledgeBaseId: number
    oldPrefix: string
    newPrefix: string
  }): Promise<void> {
    if (!this.queryService || !this.queryService.isConnected()) return

    const kb = await this.getById(params.knowledgeBaseId)
    if (!kb?.databaseName) return

    const namespace = this.getNamespace()
    const oldPrefix = this.normalizeFileKey(params.oldPrefix).replace(/\/+$/, '') + '/'
    const newPrefix = this.normalizeFileKey(params.newPrefix).replace(/\/+$/, '') + '/'

    const sql = `
      UPDATE kb_document SET
        file_key = string::replace(file_key, $oldPrefix, $newPrefix),
        file_path = string::replace(file_path, $oldPrefix, $newPrefix),
        updated_at = time::now()
      WHERE string::starts_with(file_key, $oldPrefix);

      -- 🔥 同步更新 kb_document_embedding 关联表
      UPDATE kb_document_embedding SET
        file_key = string::replace(file_key, $oldPrefix, $newPrefix),
        updated_at = time::now()
      WHERE string::starts_with(file_key, $oldPrefix);
    `

    try {
      await this.queryService.queryInDatabase(namespace, kb.databaseName, sql, {
        oldPrefix,
        newPrefix
      })
    } catch (error) {
      logger.warn('[KnowledgeLibraryService] Failed to sync moved directory to SurrealDB', {
        knowledgeBaseId: params.knowledgeBaseId,
        oldPrefix: params.oldPrefix,
        newPrefix: params.newPrefix,
        error
      })
    }
  }

  /**
   * 删除文件/目录后，同步删除 kb_document、kb_document_embedding 以及关联 chunk
   *
   * TODO: 新架构下 chunks 存储在动态分表中（如 emb_cfg_xxx_3072_chunks）
   * 当前 `DELETE chunk` 语句为旧代码兼容，新分表的 chunks 需要通过
   * kb_document_embedding 记录的 embedding_config_id 和 dimensions 构造表名后删除
   */
  async syncDeletedPathToSurrealDB(params: {
    knowledgeBaseId: number
    filePath: string
    isDirectory: boolean
  }): Promise<void> {
    if (!this.queryService || !this.queryService.isConnected()) return

    const kb = await this.getById(params.knowledgeBaseId)
    if (!kb?.databaseName) return

    const namespace = this.getNamespace()
    const normalized = this.normalizeFileKey(params.filePath)

    const prefix = normalized.replace(/\/+$/, '') + '/'

    // 注意: 新架构下 chunks 存储在 emb_cfg_{configId}_{dim}_chunks 分表中
    // 这里的 DELETE chunk 只能清理旧 chunk 表，新分表需要额外处理
    const sql = params.isDirectory
      ? `
        LET $docIds = (SELECT VALUE id FROM kb_document WHERE string::starts_with(file_key, $prefix));
        DELETE chunk WHERE document INSIDE $docIds;
        DELETE kb_document WHERE string::starts_with(file_key, $prefix);
        -- 🔥 级联删除 kb_document_embedding 关联表
        DELETE kb_document_embedding WHERE string::starts_with(file_key, $prefix);
      `
      : `
        LET $docIds = (SELECT VALUE id FROM kb_document WHERE file_key = $fileKey);
        DELETE chunk WHERE document INSIDE $docIds;
        DELETE kb_document WHERE file_key = $fileKey;
        -- 🔥 级联删除 kb_document_embedding 关联表
        DELETE kb_document_embedding WHERE file_key = $fileKey;
      `

    try {
      await this.queryService.queryInDatabase(namespace, kb.databaseName, sql, {
        prefix,
        fileKey: normalized
      })
    } catch (error) {
      logger.warn('[KnowledgeLibraryService] Failed to sync deleted path to SurrealDB', {
        knowledgeBaseId: params.knowledgeBaseId,
        filePath: params.filePath,
        isDirectory: params.isDirectory,
        error
      })
    }
  }

  /**
   * 恢复知识库数据库
   * 从元数据文件中读取知识库列表,为每个知识库重建 SurrealDB 数据库和 schema
   * 用于数据库删除后的恢复场景
   */
  async restoreKnowledgeBaseDatabases(): Promise<{
    restored: string[]
    failed: Array<{ name: string; error: string }>
  }> {
    const result = {
      restored: [] as string[],
      failed: [] as Array<{ name: string; error: string }>
    }

    if (!this.queryService || !this.queryService.isConnected()) {
      logger.warn('QueryService not available, skipping knowledge base database restoration')
      return result
    }

    try {
      // 1. 读取所有知识库元数据
      const knowledgeBases = await this.getAll()

      if (knowledgeBases.length === 0) {
        logger.info('No knowledge bases to restore')
        return result
      }

      logger.info(`Restoring ${knowledgeBases.length} knowledge base databases...`)

      // 2. 获取当前已存在的数据库列表
      const infoResult = await this.queryService.query<any[]>('INFO FOR NS;')
      const nsInfo = infoResult?.[0]
      const existingDatabases = new Set<string>()

      if (nsInfo && nsInfo.databases) {
        for (const dbName in nsInfo.databases) {
          existingDatabases.add(dbName)
        }
        logger.debug('Existing databases:', { databases: Array.from(existingDatabases) })
      }

      // 3. 为每个知识库恢复数据库
      for (const kb of knowledgeBases) {
        if (!kb.databaseName) {
          logger.warn(`Knowledge base ${kb.id} (${kb.name}) has no databaseName, skipping`)
          continue
        }

        try {
          const dbName = kb.databaseName

          // 检查数据库是否已存在
          if (existingDatabases.has(dbName)) {
            logger.debug(`Database ${dbName} already exists, skipping creation`)
            result.restored.push(dbName)
            continue
          }

          // 创建数据库
          logger.info(`Creating database: ${dbName} for knowledge base ${kb.id} (${kb.name})`)
          await this.queryService.query(`DEFINE DATABASE \`${dbName}\`;`)

          // 初始化数据库的 schema (kb_document 表)
          const namespace = this.queryService.getNamespace() || 'knowledge'
          const schemaSql = kbDocumentTable.sql

          logger.debug(`Initializing schema for database: ${dbName}`)
          await this.queryService.queryInDatabase(namespace, dbName, schemaSql)

          result.restored.push(dbName)
          logger.info(`Successfully restored database: ${dbName}`)

          // 🎯 扫描本地文档并同步到 kb_document
          await this.syncLocalDocumentsToKbDocument(kb)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          logger.error(`Failed to restore database for KB ${kb.id} (${kb.name}):`, error)
          result.failed.push({ name: kb.name, error: errorMessage })
        }
      }

      logger.info(
        `Knowledge base database restoration completed: ${result.restored.length} restored, ${result.failed.length} failed`
      )

      return result
    } catch (error) {
      logger.error('Failed to restore knowledge base databases:', error)
      throw error
    }
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

  // ==========================================================================
  // 本地文档同步到 kb_document
  // ==========================================================================

  /**
   * 扫描本地知识库文档目录，将文档元数据同步到 kb_document 表
   * 用于数据库恢复或初始化场景
   */
  private async syncLocalDocumentsToKbDocument(kb: KnowledgeBaseMeta): Promise<void> {
    if (!this.queryService || !this.queryService.isConnected()) {
      logger.warn('[KnowledgeLibraryService] QueryService not available, skip document sync')
      return
    }

    if (!kb.documentPath || !kb.databaseName) {
      logger.warn('[KnowledgeLibraryService] Knowledge base missing documentPath or databaseName', {
        kbId: kb.id,
        kbName: kb.name
      })
      return
    }

    try {
      // 获取知识库根目录
      const kbRoot = this.documentService.getFullDirectoryPath(kb.documentPath)

      // 使用 FileScannerService 扫描文档（注入 QueryService 以支持嵌入信息查询）
      const scanner = new FileScannerService(this.queryService)
      const files = await scanner.scanDirectory(kbRoot, kb.databaseName)

      if (files.length === 0) {
        logger.debug('[KnowledgeLibraryService] No documents found in knowledge base', {
          kbId: kb.id,
          kbName: kb.name,
          kbRoot
        })
        return
      }

      logger.info(`[KnowledgeLibraryService] Syncing ${files.length} documents to kb_document`, {
        kbId: kb.id,
        kbName: kb.name
      })

      const namespace = this.getNamespace()

      // 批量 UPSERT 文档记录
      for (const file of files) {
        const hints = this.buildFileHints(file.path)

        const sql = `
          UPSERT kb_document SET
            file_key = $fileKey,
            file_name = $fileName,
            file_path = $filePath,
            file_type = $fileType,
            updated_at = time::now()
          WHERE file_key = $fileKey;
        `

        try {
          await this.queryService.queryInDatabase(namespace, kb.databaseName, sql, {
            fileKey: hints.fileKey,
            fileName: hints.fileName,
            filePath: hints.filePath,
            fileType: hints.fileType
          })
        } catch (error) {
          logger.warn('[KnowledgeLibraryService] Failed to sync document to kb_document', {
            kbId: kb.id,
            fileKey: hints.fileKey,
            error: error instanceof Error ? error.message : String(error)
          })
          // 继续处理其他文档
        }
      }

      logger.info(`[KnowledgeLibraryService] Successfully synced ${files.length} documents`, {
        kbId: kb.id,
        kbName: kb.name
      })
    } catch (error) {
      logger.error('[KnowledgeLibraryService] Failed to sync local documents to kb_document', {
        kbId: kb.id,
        kbName: kb.name,
        error: error instanceof Error ? error.message : String(error)
      })
      // 不抛出错误，不阻止数据库恢复流程
    }
  }

  // ==========================================================================
  // 向量表枚举（RAG 检索辅助）
  // ==========================================================================

  /**
   * 列出知识库中已存在的嵌入向量表（用于 RAG 检索）
   * @param knowledgeBaseId 知识库 ID
   * @returns 向量表列表（表名、配置ID、模型名称、维度、chunk 数量）
   */
  async listEmbeddingTables(knowledgeBaseId: number): Promise<
    Array<{
      tableName: string
      configId: string
      configName: string | null
      dimensions: number
      chunkCount: number
    }>
  > {
    if (!this.queryService || !this.queryService.isConnected()) {
      logger.warn(
        '[KnowledgeLibraryService] QueryService not available for listing embedding tables'
      )
      return []
    }

    const kb = await this.getById(knowledgeBaseId)
    if (!kb?.databaseName) {
      logger.warn('[KnowledgeLibraryService] Knowledge base not found or missing databaseName', {
        knowledgeBaseId
      })
      return []
    }

    try {
      const namespace = this.getNamespace()

      // 1. 查询数据库的表结构
      const infoSql = 'INFO FOR DB;'
      const infoResult = await this.queryService.queryInDatabase<any[]>(
        namespace,
        kb.databaseName,
        infoSql
      )

      const dbInfo = infoResult?.[0]
      if (!dbInfo || !dbInfo.tables) {
        logger.debug('[KnowledgeLibraryService] No tables found in database', {
          knowledgeBaseId,
          databaseName: kb.databaseName
        })
        return []
      }

      // 2. 查询 kb_document_embedding 表，获取所有嵌入配置的名称和维度
      //    参考 api-server/routes/knowledge.ts 的实现
      let embeddingConfigMap: Map<string, { configName: string | null; dimensions: number }> =
        new Map()

      try {
        const embeddingSql = `
          SELECT
            embedding_config_id,
            embedding_config_name,
            dimensions
          FROM kb_document_embedding
          GROUP BY embedding_config_id, embedding_config_name, dimensions;
        `
        const embeddingResult = await this.queryService.queryInDatabase<any[]>(
          namespace,
          kb.databaseName,
          embeddingSql
        )

        // SurrealDB query() 返回 [[records], queryInfo]，所以需要取 [0]
        const embeddingRecords = Array.isArray(embeddingResult?.[0]) ? embeddingResult[0] : []

        logger.debug('[KnowledgeLibraryService] kb_document_embedding query result', {
          knowledgeBaseId,
          recordCount: embeddingRecords.length,
          sample: embeddingRecords[0]
        })

        for (const record of embeddingRecords) {
          if (record.embedding_config_id) {
            embeddingConfigMap.set(record.embedding_config_id, {
              configName: record.embedding_config_name || null,
              dimensions: record.dimensions || 0
            })
          }
        }
      } catch (error) {
        logger.warn(
          '[KnowledgeLibraryService] Failed to query kb_document_embedding, fallback to table parsing',
          {
            error: error instanceof Error ? error.message : String(error)
          }
        )
      }

      // 3. 过滤出 emb_*_chunks 格式的表
      const embeddingTablePattern = /^emb_(.+)_(\d+)_chunks$/
      const results: Array<{
        tableName: string
        configId: string
        configName: string | null
        dimensions: number
        chunkCount: number
      }> = []

      for (const tableName in dbInfo.tables) {
        const match = tableName.match(embeddingTablePattern)
        if (!match) continue

        const configId = match[1]
        const dimensions = parseInt(match[2], 10)

        // 从 kb_document_embedding 获取 configName
        // 表名中的 configId 可能包含额外的 cfg_ 前缀（如 cfg_cfg_xxx），需 fallback 匹配
        const configInfo =
          embeddingConfigMap.get(configId) ?? embeddingConfigMap.get(configId.replace(/^cfg_/, ''))
        const configName = configInfo?.configName ?? null

        // 4. 查询表中的 chunk 数量
        try {
          const countSql = `SELECT count() AS count FROM \`${tableName}\` GROUP ALL;`
          const countResult = await this.queryService.queryInDatabase<any[]>(
            namespace,
            kb.databaseName,
            countSql
          )

          const chunkCount = countResult?.[0]?.[0]?.count ?? 0

          results.push({
            tableName,
            configId,
            configName,
            dimensions,
            chunkCount
          })
        } catch (error) {
          logger.warn('[KnowledgeLibraryService] Failed to count chunks in table', {
            tableName,
            error: error instanceof Error ? error.message : String(error)
          })
          // 即使计数失败也添加表，count 设为 0
          results.push({
            tableName,
            configId,
            configName,
            dimensions,
            chunkCount: 0
          })
        }
      }

      logger.debug('[KnowledgeLibraryService] Listed embedding tables', {
        knowledgeBaseId,
        count: results.length,
        tables: results.map((r) => `${r.tableName} (${r.configName || 'unnamed'})`)
      })

      return results
    } catch (error) {
      logger.error('[KnowledgeLibraryService] Failed to list embedding tables', {
        knowledgeBaseId,
        error: error instanceof Error ? error.message : String(error)
      })
      return []
    }
  }
}

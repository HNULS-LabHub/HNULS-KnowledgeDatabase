import { Surreal } from 'surrealdb'
import { SurrealDBConfig } from './config'
import { logger } from '../logger'
import { ServiceTracker } from '../logger/service-tracker'
import {
  DatabaseOperationError,
  DatabaseConnectionError,
  QuerySyntaxError,
  RecordNotFoundError,
  parseSurrealDBError
} from './database-errors'

/**
 * 查询服务 - 使用 SDK 进行数据库操作并自动记录日志
 */
export class QueryService {
  private db: Surreal
  private connected: boolean = false
  private enableLogging: boolean = true
  private namespace?: string
  private database?: string
  private tracker: ServiceTracker

  constructor() {
    this.db = new Surreal()
    this.tracker = new ServiceTracker('QueryService')
  }

  /**
   * 获取实例 ID（用于追踪）
   */
  getInstanceId(): string {
    return this.tracker.getInstanceId()
  }

  /**
   * 连接到 SurrealDB 服务器
   */
  async connect(serverUrl: string, config: SurrealDBConfig): Promise<void> {
    try {
      await this.db.connect(serverUrl)
      await this.db.signin({
        username: config.username,
        password: config.password
      })
      await this.db.use({
        namespace: config.namespace,
        database: config.database
      })
      this.connected = true
      this.namespace = config.namespace
      this.database = config.database
      logger.info('QueryService connected to SurrealDB', {
        namespace: config.namespace,
        database: config.database,
        instanceId: this.tracker.getInstanceId()
      })
    } catch (error) {
      const errorInfo = parseSurrealDBError(error)
      logger.error('Failed to connect QueryService', {
        serverUrl,
        namespace: config.namespace,
        database: config.database,
        error: errorInfo
      })
      throw new DatabaseConnectionError(`无法连接到数据库: ${errorInfo.message}`, error)
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.db.close()
      this.connected = false
      logger.info('QueryService disconnected')
    }
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.connected
  }

  /**
   * 获取当前命名空间
   */
  getNamespace(): string | undefined {
    return this.namespace
  }

  /**
   * 获取当前数据库名称
   */
  getDatabase(): string | undefined {
    return this.database
  }

  /**
   * 设置是否启用日志记录
   */
  setLogging(enabled: boolean): void {
    this.enableLogging = enabled
  }

  // ==================== CRUD 操作 ====================

  /**
   * 执行数据库操作并统一处理错误
   * @private
   */
  private async executeWithErrorHandling<T>(
    operation: string,
    table: string,
    executor: () => Promise<T>,
    params?: any
  ): Promise<T> {
    const startTime = Date.now()

    try {
      // 执行操作
      const result = await executor()

      // 记录成功的操作
      const duration = Date.now() - startTime
      const count = Array.isArray(result) ? result.length : 1

      logger.debug(`DB ${operation} succeeded`, {
        table,
        duration: `${duration}ms`,
        resultCount: count
      })

      await this.log(operation, table, params, count)

      return result
    } catch (error) {
      // 解析错误信息
      const errorInfo = parseSurrealDBError(error)
      const duration = Date.now() - startTime

      // 详细的错误日志
      logger.error(`DB ${operation} failed`, {
        table,
        params,
        duration: `${duration}ms`,
        error: errorInfo.message,
        details: errorInfo.details,
        code: errorInfo.code
      })

      // 包装错误信息，提供更多上下文
      throw new DatabaseOperationError(
        `数据库操作失败 [${operation}] ${table}: ${errorInfo.message}`,
        operation,
        table,
        params,
        error
      )
    }
  }

  /**
   * 创建记录
   */
  async create<T = any>(table: string, data: any): Promise<T> {
    this.ensureConnected()

    return this.executeWithErrorHandling(
      'CREATE',
      table,
      async () => {
        const result = (await this.db.create(table, data)) as T

        // 验证结果
        if (!result) {
          throw new Error(`Create operation returned empty result`)
        }

        return result
      },
      { data }
    )
  }

  /**
   * 查询记录
   */
  async select<T = any>(table: string, id?: string): Promise<T | T[]> {
    this.ensureConnected()

    return this.executeWithErrorHandling(
      'SELECT',
      table,
      async () => {
        const result = id ? await this.db.select(`${table}:${id}`) : await this.db.select(table)

        // 如果查询单条记录但结果为空，抛出 RecordNotFoundError
        if (id && !result) {
          throw new RecordNotFoundError(table, id)
        }

        return result as T | T[]
      },
      { id }
    )
  }

  /**
   * 更新记录
   */
  async update<T = any>(table: string, id: string, data: any): Promise<T> {
    this.ensureConnected()

    return this.executeWithErrorHandling(
      'UPDATE',
      table,
      async () => {
        const result = (await this.db.update(`${table}:${id}`, data)) as T

        // 验证结果
        if (!result) {
          throw new RecordNotFoundError(table, id)
        }

        return result
      },
      { id, data }
    )
  }

  /**
   * 删除记录
   */
  async delete(table: string, id: string): Promise<void> {
    this.ensureConnected()

    await this.executeWithErrorHandling(
      'DELETE',
      table,
      async () => {
        await this.db.delete(`${table}:${id}`)
      },
      { id }
    )
  }

  /**
   * 执行原始查询
   */
  async query<T = any>(sql: string, params?: Record<string, any>): Promise<T> {
    this.ensureConnected()

    return this.executeWithErrorHandling(
      'QUERY',
      'custom',
      async () => {
        const result = (await this.db.query(sql, params)) as any
        return result as T
      },
      { sql, params }
    )
  }

  /**
   * 在指定数据库中执行查询（不会写入 operation_log）
   */
  async queryInDatabase<T = any>(
    namespace: string,
    database: string,
    sql: string,
    params?: Record<string, any>
  ): Promise<T> {
    this.ensureConnected()
    const prevNamespace = this.namespace
    const prevDatabase = this.database

    try {
      await this.db.use({ namespace, database })

      const startTime = Date.now()
      const result = (await this.db.query(sql, params)) as any
      const duration = Date.now() - startTime

      logger.debug('DB QUERY_IN_DATABASE succeeded', {
        namespace,
        database,
        duration: `${duration}ms`,
        sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : '')
      })

      return result as T
    } catch (error) {
      const errorInfo = parseSurrealDBError(error)

      logger.error('DB QUERY_IN_DATABASE failed', {
        namespace,
        database,
        sql,
        params,
        error: errorInfo.message,
        details: errorInfo.details
      })

      throw new QuerySyntaxError(
        `跨数据库查询失败 [${namespace}.${database}]: ${errorInfo.message}`,
        sql,
        params,
        error
      )
    } finally {
      if (prevNamespace && prevDatabase) {
        await this.db.use({ namespace: prevNamespace, database: prevDatabase })
      }
    }
  }

  /**
   * 向量检索（KNN）
   */
  async vectorSearch(
    namespace: string,
    database: string,
    queryVector: number[],
    k: number = 10,
    ef: number = 100
  ): Promise<any> {
    const sql = `
      SELECT
        id,
        content,
        chunk_index,
        document.file_key AS file_key,
        document.file_name AS file_name,
        vector::distance::knn() AS distance
      FROM chunk
      WHERE embedding <|${k},${ef}|> $queryVector
      ORDER BY distance ASC;
    `

    try {
      return await this.queryInDatabase(namespace, database, sql, { queryVector })
    } catch (error) {
      logger.error('Vector search failed', {
        namespace,
        database,
        k,
        ef,
        vectorLength: queryVector.length,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  // ==================== 日志记录 ====================

  /**
   * 记录操作日志
   */
  private async log(
    action: string,
    table: string,
    params: any,
    resultCount?: number
  ): Promise<void> {
    if (!this.enableLogging) return

    try {
      // 临时禁用日志，避免递归
      this.enableLogging = false

      await this.db.create('operation_log', {
        action,
        table_name: table,
        query: JSON.stringify(params),
        params: params,
        result_count: resultCount,
        timestamp: new Date(),
        source: 'electron_backend'
      })
    } catch (error) {
      logger.error('Failed to log operation', error)
    } finally {
      this.enableLogging = true
    }
  }

  /**
   * 查询操作日志
   */
  async getOperationLogs(options?: {
    limit?: number
    table?: string
    action?: string
    startDate?: Date
    endDate?: Date
  }): Promise<any[]> {
    this.ensureConnected()

    let query = 'SELECT * FROM operation_log'
    const conditions: string[] = []

    if (options?.table) {
      conditions.push(`table_name = '${options.table}'`)
    }
    if (options?.action) {
      conditions.push(`action = '${options.action}'`)
    }
    if (options?.startDate) {
      conditions.push(`timestamp >= '${options.startDate.toISOString()}'`)
    }
    if (options?.endDate) {
      conditions.push(`timestamp <= '${options.endDate.toISOString()}'`)
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }

    query += ' ORDER BY timestamp DESC'

    if (options?.limit) {
      query += ` LIMIT ${options.limit}`
    }

    // 查询日志时不记录日志
    this.enableLogging = false
    const result = (await this.db.query(query)) as any
    this.enableLogging = true

    return (result[0]?.result || []) as any[]
  }

  /**
   * 确保已连接
   */
  private ensureConnected(): void {
    if (!this.connected) {
      const error = new DatabaseConnectionError(
        'QueryService is not connected. Call connect() first.'
      )
      logger.error('Database operation attempted without connection', {
        instanceId: this.tracker.getInstanceId()
      })
      throw error
    }
  }
}

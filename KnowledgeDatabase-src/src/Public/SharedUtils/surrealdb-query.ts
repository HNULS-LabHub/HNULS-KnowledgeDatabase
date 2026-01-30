/**
 * @file SurrealDB 查询工具类
 * @description 从 QueryService 提取的 CRUD 操作，供所有进程共享使用
 * 
 * 核心特性:
 * - 统一的错误处理，所有错误自动打印 error 级别日志
 * - 类型安全的 CRUD 操作
 * - 支持跨数据库查询
 * - 支持向量检索
 */

import { Surreal } from 'surrealdb'

// ============================================================================
// 类型定义
// ============================================================================

/**
 * SurrealDB 配置
 */
export interface SurrealDBConfig {
  username: string
  password: string
  namespace: string
  database: string
}

/**
 * 错误信息解析结果
 */
interface ParsedError {
  message: string
  code?: string
  details?: string
}

// ============================================================================
// 错误类定义
// ============================================================================

/**
 * 数据库操作错误基类
 */
export class DatabaseOperationError extends Error {
  constructor(
    message: string,
    public operation: string,
    public table: string,
    public params: any,
    public originalError: unknown
  ) {
    super(message)
    this.name = 'DatabaseOperationError'
    
    if (originalError instanceof Error && originalError.stack) {
      this.stack = originalError.stack
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      operation: this.operation,
      table: this.table,
      params: this.params,
      originalError: this.originalError instanceof Error 
        ? this.originalError.message 
        : String(this.originalError)
    }
  }
}

/**
 * 连接错误
 */
export class DatabaseConnectionError extends Error {
  constructor(message: string, public originalError?: unknown) {
    super(message)
    this.name = 'DatabaseConnectionError'
  }
}

/**
 * 查询语法错误
 */
export class QuerySyntaxError extends DatabaseOperationError {
  constructor(
    message: string,
    sql: string,
    params: any,
    originalError: unknown
  ) {
    super(message, 'QUERY', 'custom', { sql, params }, originalError)
    this.name = 'QuerySyntaxError'
  }
}

/**
 * 记录不存在错误
 */
export class RecordNotFoundError extends DatabaseOperationError {
  constructor(table: string, id: string) {
    super(
      `Record not found: ${table}:${id}`,
      'SELECT',
      table,
      { id },
      null
    )
    this.name = 'RecordNotFoundError'
  }
}

// ============================================================================
// 错误解析工具
// ============================================================================

/**
 * 从 SurrealDB 错误中提取有用信息
 */
export function parseSurrealDBError(error: unknown): ParsedError {
  if (error instanceof Error) {
    const message = error.message
    
    // 解析常见的 SurrealDB 错误模式
    if (message.includes('already exists')) {
      return {
        message: '记录已存在',
        code: 'DUPLICATE',
        details: message
      }
    }
    
    if (message.includes('not found')) {
      return {
        message: '记录不存在',
        code: 'NOT_FOUND',
        details: message
      }
    }
    
    if (message.includes('syntax error') || message.includes('parse error')) {
      return {
        message: 'SQL 语法错误',
        code: 'SYNTAX_ERROR',
        details: message
      }
    }
    
    if (message.includes('permission') || message.includes('access denied')) {
      return {
        message: '权限不足',
        code: 'PERMISSION_DENIED',
        details: message
      }
    }
    
    if (message.includes('connection') || message.includes('connect')) {
      return {
        message: '数据库连接失败',
        code: 'CONNECTION_ERROR',
        details: message
      }
    }
    
    return {
      message: message,
      details: message
    }
  }
  
  return {
    message: String(error),
    details: String(error)
  }
}

// ============================================================================
// SurrealDB 查询服务类
// ============================================================================

/**
 * SurrealDB 查询服务 - 提供统一的 CRUD 操作
 * 
 * @example
 * ```typescript
 * const queryService = new SurrealDBQueryService()
 * 
 * // 连接数据库
 * await queryService.connect('ws://localhost:8000', {
 *   username: 'root',
 *   password: 'root',
 *   namespace: 'test',
 *   database: 'test'
 * })
 * 
 * // 创建记录
 * const user = await queryService.create('user', { name: 'John', age: 30 })
 * 
 * // 查询记录
 * const users = await queryService.select('user')
 * const john = await queryService.select('user', 'user_id')
 * 
 * // 更新记录
 * await queryService.update('user', 'user_id', { age: 31 })
 * 
 * // 删除记录
 * await queryService.delete('user', 'user_id')
 * 
 * // 断开连接
 * await queryService.disconnect()
 * ```
 */
export class SurrealDBQueryService {
  private db: Surreal
  private connected: boolean = false
  private enableLogging: boolean = true
  private namespace?: string
  private database?: string

  constructor() {
    this.db = new Surreal()
  }

  // ==========================================================================
  // 连接管理
  // ==========================================================================

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
      
      console.info('[SurrealDBQueryService] Connected to SurrealDB', {
        namespace: config.namespace,
        database: config.database
      })
    } catch (error) {
      const errorInfo = parseSurrealDBError(error)
      console.error('[SurrealDBQueryService] Failed to connect', {
        serverUrl,
        namespace: config.namespace,
        database: config.database,
        error: errorInfo
      })
      throw new DatabaseConnectionError(
        `无法连接到数据库: ${errorInfo.message}`,
        error
      )
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.db.close()
      this.connected = false
      console.info('[SurrealDBQueryService] Disconnected')
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

  // ==========================================================================
  // CRUD 操作
  // ==========================================================================

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
      
      console.debug(`[SurrealDBQueryService] DB ${operation} succeeded`, {
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
      
      // ⚠️ 重点：所有错误使用 error 级别日志
      console.error(`[SurrealDBQueryService] DB ${operation} failed`, {
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
   * @param table 表名
   * @param id 可选的记录 ID，如果提供则查询单条，否则查询全部
   */
  async select<T = any>(table: string, id?: string): Promise<T | T[]> {
    this.ensureConnected()
    
    return this.executeWithErrorHandling(
      'SELECT',
      table,
      async () => {
        const result = id 
          ? await this.db.select(`${table}:${id}`) 
          : await this.db.select(table)
        
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
      
      console.debug('[SurrealDBQueryService] DB QUERY_IN_DATABASE succeeded', {
        namespace,
        database,
        duration: `${duration}ms`,
        sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : '')
      })
      
      return result as T
    } catch (error) {
      const errorInfo = parseSurrealDBError(error)
      
      console.error('[SurrealDBQueryService] DB QUERY_IN_DATABASE failed', {
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
      console.error('[SurrealDBQueryService] Vector search failed', {
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

  // ==========================================================================
  // 日志记录
  // ==========================================================================

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
        source: 'shared_utils'
      })
    } catch (error) {
      console.error('[SurrealDBQueryService] Failed to log operation', error)
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

  // ==========================================================================
  // 辅助方法
  // ==========================================================================

  /**
   * 确保已连接
   */
  private ensureConnected(): void {
    if (!this.connected) {
      const error = new DatabaseConnectionError(
        'SurrealDBQueryService is not connected. Call connect() first.'
      )
      console.error('[SurrealDBQueryService] Database operation attempted without connection')
      throw error
    }
  }

  /**
   * 获取原始数据库实例（供高级操作使用）
   */
  getDb(): Surreal {
    return this.db
  }
}

import { Surreal } from 'surrealdb'
import { SurrealDBConfig } from './config'
import { logger } from '../logger'

/**
 * 查询服务 - 使用 SDK 进行数据库操作并自动记录日志
 */
export class QueryService {
  private db: Surreal
  private connected: boolean = false
  private enableLogging: boolean = true

  constructor() {
    this.db = new Surreal()
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
      logger.info('QueryService connected to SurrealDB')
    } catch (error) {
      logger.error('Failed to connect QueryService', error)
      throw error
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
   * 设置是否启用日志记录
   */
  setLogging(enabled: boolean): void {
    this.enableLogging = enabled
  }

  // ==================== CRUD 操作 ====================

  /**
   * 创建记录
   */
  async create<T = any>(table: string, data: any): Promise<T> {
    this.ensureConnected()
    const result = (await this.db.create(table, data)) as T
    await this.log('CREATE', table, { data }, 1)
    return result
  }

  /**
   * 查询记录
   */
  async select<T = any>(table: string, id?: string): Promise<T | T[]> {
    this.ensureConnected()
    const result = id ? await this.db.select(`${table}:${id}`) : await this.db.select(table)
    const count = Array.isArray(result) ? result.length : 1
    await this.log('SELECT', table, { id }, count)
    return result as T | T[]
  }

  /**
   * 更新记录
   */
  async update<T = any>(table: string, id: string, data: any): Promise<T> {
    this.ensureConnected()
    const result = (await this.db.update(`${table}:${id}`, data)) as T
    await this.log('UPDATE', table, { id, data }, 1)
    return result
  }

  /**
   * 删除记录
   */
  async delete(table: string, id: string): Promise<void> {
    this.ensureConnected()
    await this.db.delete(`${table}:${id}`)
    await this.log('DELETE', table, { id }, 1)
  }

  /**
   * 执行原始查询
   */
  async query<T = any>(sql: string, params?: Record<string, any>): Promise<T> {
    this.ensureConnected()
    const result = (await this.db.query(sql, params)) as any
    await this.log('QUERY', 'custom', { sql, params }, Array.isArray(result) ? result.length : 0)
    return result as T
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
      throw new Error('QueryService is not connected. Call connect() first.')
    }
  }
}

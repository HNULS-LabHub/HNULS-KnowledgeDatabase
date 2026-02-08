import type { SurrealDBConfig } from './config'
import { logger } from '../logger'
import { ServiceTracker } from '../logger/service-tracker'
import { SurrealDBQueryService } from '@shared-utils/surrealdb-query'
import type { SurrealDBLogger } from '@shared-utils'

/**
 * 查询服务（Main Process）
 *
 * 说明：
 * - 统一委托到 SharedUtils 的 SurrealDBQueryService，避免 Main/Utility 两套实现导致：
 *   - 错误类型不一致（instanceof 失效）
 *   - queryInDatabase 并发串库（db.use 切换竞态）
 */
export class QueryService {
  private readonly tracker: ServiceTracker
  private readonly surrealQuery: SurrealDBQueryService

  constructor() {
    this.tracker = new ServiceTracker('QueryService')

    const instanceId = this.tracker.getInstanceId()
    const sharedLogger: SurrealDBLogger = {
      debug: (message: string, meta?: any) =>
        logger.debug(message, meta ? { ...meta, instanceId } : { instanceId }),
      info: (message: string, meta?: any) =>
        logger.info(message, meta ? { ...meta, instanceId } : { instanceId }),
      warn: (message: string, meta?: any) =>
        logger.warn(message, meta ? { ...meta, instanceId } : { instanceId }),
      error: (message: string, meta?: any) =>
        logger.error(message, meta ? { ...meta, instanceId } : { instanceId })
    }

    this.surrealQuery = new SurrealDBQueryService({
      logger: sharedLogger,
      operationLogSource: 'electron_backend'
    })
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
    await this.surrealQuery.connect(serverUrl, {
      username: config.username,
      password: config.password,
      namespace: config.namespace,
      database: config.database
    })

    logger.info('QueryService connected to SurrealDB', {
      namespace: config.namespace,
      database: config.database,
      instanceId: this.tracker.getInstanceId()
    })
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    await this.surrealQuery.disconnect()
    logger.info('QueryService disconnected', { instanceId: this.tracker.getInstanceId() })
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.surrealQuery.isConnected()
  }

  /**
   * 获取当前命名空间
   */
  getNamespace(): string | undefined {
    return this.surrealQuery.getNamespace()
  }

  /**
   * 获取当前数据库名称
   */
  getDatabase(): string | undefined {
    return this.surrealQuery.getDatabase()
  }

  /**
   * 设置是否启用操作日志记录（operation_log）
   */
  setLogging(enabled: boolean): void {
    this.surrealQuery.setLogging(enabled)
  }

  // ==================== CRUD / Query ====================

  async create<T = any>(table: string, data: any): Promise<T> {
    return await this.surrealQuery.create<T>(table, data)
  }

  async select<T = any>(table: string, id?: string): Promise<T | T[]> {
    return await this.surrealQuery.select<T>(table, id)
  }

  async update<T = any>(table: string, id: string, data: any): Promise<T> {
    return await this.surrealQuery.update<T>(table, id, data)
  }

  async delete(table: string, id: string): Promise<void> {
    await this.surrealQuery.delete(table, id)
  }

  async querySql<T = any>(sql: string, params?: Record<string, any>): Promise<T> {
    return await this.surrealQuery.query<T>(sql, params)
  }

  // 为保持历史 API（DatabaseIPCHandler 使用）
  async query<T = any>(sql: string, params?: Record<string, any>): Promise<T> {
    return await this.querySql<T>(sql, params)
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
    return await this.surrealQuery.queryInDatabase<T>(namespace, database, sql, params)
  }

  async vectorSearch(
    namespace: string,
    database: string,
    queryVector: number[],
    k: number = 10,
    ef: number = 100,
    options?: { fileKey?: string; fileKeys?: string[] }
  ): Promise<any> {
    return await this.surrealQuery.vectorSearch(namespace, database, queryVector, k, ef, options)
  }

  async getOperationLogs(options?: {
    limit?: number
    table?: string
    action?: string
    startDate?: Date
    endDate?: Date
  }): Promise<any[]> {
    return await this.surrealQuery.getOperationLogs(options)
  }
}

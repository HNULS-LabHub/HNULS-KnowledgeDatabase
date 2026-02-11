/**
 * @file SurrealDB 客户端（子进程专用）
 * @description 直接使用 surrealdb SDK，不依赖公共封装层
 */

import { Surreal } from 'surrealdb'
import type { KGDBConfig } from '@shared/knowledge-graph-ipc.types'

const log = (msg: string, data?: any): void => {
  if (data) console.log(`[KG-SurrealClient] ${msg}`, JSON.stringify(data))
  else console.log(`[KG-SurrealClient] ${msg}`)
}

const logError = (msg: string, error?: any): void => {
  console.error(`[KG-SurrealClient] ${msg}`, error)
}

export class KGSurrealClient {
  private db: Surreal
  private connected = false
  private currentNamespace = ''
  private currentDatabase = ''

  constructor() {
    this.db = new Surreal()
  }

  async connect(config: KGDBConfig): Promise<void> {
    if (this.connected) await this.disconnect()

    try {
      await this.db.connect(config.serverUrl)
      await this.db.signin({ username: config.username, password: config.password })
      await this.db.use({ namespace: config.namespace, database: config.database })
      this.currentNamespace = config.namespace
      this.currentDatabase = config.database
      this.connected = true
      log('Connected', { serverUrl: config.serverUrl, namespace: config.namespace, database: config.database })
    } catch (error) {
      logError('Connection failed', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.db.close()
      this.connected = false
      log('Disconnected')
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  /**
   * 在当前数据库执行查询，直接返回 SDK 原始结果
   */
  async query<T = any>(sql: string, params?: Record<string, any>): Promise<T> {
    if (!this.connected) throw new Error('KGSurrealClient: Not connected')
    try {
      const result = await this.db.query(sql, params)
      return result as T
    } catch (error) {
      logError(`Query failed: ${sql}`, error)
      throw error
    }
  }

  /**
   * 在指定数据库执行查询（跨库拉 chunks），完成后切回原库
   */
  async queryInDatabase<T = any>(
    namespace: string,
    database: string,
    sql: string,
    params?: Record<string, any>
  ): Promise<T> {
    if (!this.connected) throw new Error('KGSurrealClient: Not connected')

    try {
      await this.db.use({ namespace, database })
      const result = await this.db.query(sql, params)
      return result as T
    } catch (error) {
      logError(`Cross-db query failed [${namespace}.${database}]: ${sql}`, error)
      throw error
    } finally {
      // 切回原库
      try {
        await this.db.use({ namespace: this.currentNamespace, database: this.currentDatabase })
      } catch (restoreError) {
        logError('Failed to restore database context', restoreError)
      }
    }
  }

  /**
   * 从 SDK query 结果中提取记录数组
   * SDK v1.x db.query() 返回: [result1, result2, ...] 每个 result 对应一条 SQL 语句
   * 单条 SELECT 返回: [ [{record}, {record}] ]
   */
  extractRecords(result: any): any[] {
    if (!result) return []

    // SDK 返回 [statementResult, ...]
    if (Array.isArray(result)) {
      // 单条语句: [ [records] ]
      if (result.length >= 1 && Array.isArray(result[0])) {
        return result[0]
      }
      // 已经是 records 数组: [{...}, {...}]
      if (result.length > 0 && typeof result[0] === 'object' && !Array.isArray(result[0])) {
        return result
      }
      return []
    }

    return []
  }
}

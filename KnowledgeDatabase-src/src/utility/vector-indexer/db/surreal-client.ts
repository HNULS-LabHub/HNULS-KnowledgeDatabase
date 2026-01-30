/**
 * @file SurrealDB 客户端
 * @description Utility Process 中使用的 SurrealDB 客户端（封装 SurrealDBQueryService）
 */

import { SurrealDBQueryService } from '@shared-utils/surrealdb-query'
import type { IndexerDBConfig } from '@shared/vector-indexer-ipc.types'

// ============================================================================
// 日志
// ============================================================================

const log = (msg: string, data?: any): void => {
  if (data) {
    console.log(`[SurrealClient] ${msg}`, data)
  } else {
    console.log(`[SurrealClient] ${msg}`)
  }
}

const logError = (msg: string, error?: any): void => {
  console.error(`[SurrealClient] ${msg}`, error)
}

// ============================================================================
// SurrealClient
// ============================================================================

export class SurrealClient {
  private queryService: SurrealDBQueryService
  private connected = false
  private config?: IndexerDBConfig

  constructor() {
    this.queryService = new SurrealDBQueryService()
  }

  // ==========================================================================
  // 连接管理
  // ==========================================================================

  async connect(config: IndexerDBConfig): Promise<void> {
    if (this.connected) {
      await this.disconnect()
    }

    this.config = config

    try {
      await this.queryService.connect(config.serverUrl, {
        username: config.username,
        password: config.password,
        namespace: config.namespace,
        database: config.database
      })

      this.connected = true
      log('Connected', {
        serverUrl: config.serverUrl,
        namespace: config.namespace,
        database: config.database
      })
    } catch (error) {
      logError('Connection failed', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.queryService.disconnect()
      this.connected = false
      log('Disconnected')
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  // ==========================================================================
  // 查询方法
  // ==========================================================================

  /**
   * 在当前数据库执行查询
   */
  async query<T = any>(sql: string, params?: Record<string, any>): Promise<T> {
    if (!this.connected) {
      throw new Error('Not connected to database')
    }
    return await this.queryService.query<T>(sql, params)
  }

  /**
   * 在指定数据库执行查询
   */
  async queryInDatabase<T = any>(
    namespace: string,
    database: string,
    sql: string,
    params?: Record<string, any>
  ): Promise<T> {
    if (!this.connected || !this.config) {
      throw new Error('Not connected to database')
    }

    return await this.queryService.queryInDatabase<T>(namespace, database, sql, params)
  }

  // ==========================================================================
  // 辅助方法
  // ==========================================================================

  /**
   * 从查询结果中提取记录
   */
  extractRecords(result: any): any[] {
    if (!result) return []
    if (Array.isArray(result)) {
      // Handle double-nested arrays: [ [ {record} ] ]
      if (result.length === 1 && Array.isArray(result[0])) {
        const inner = result[0]
        if (inner.length > 0 && typeof inner[0] === 'object' && !Array.isArray(inner[0])) {
          return inner
        }
      }

      for (const entry of result) {
        if (Array.isArray(entry?.result)) {
          if (entry.result.length > 0) return entry.result
        }
      }
      if (result.length > 0 && typeof result[0] === 'object' && !('result' in result[0])) {
        return result
      }
      return []
    }
    if (Array.isArray(result?.result)) return result.result
    return []
  }
}

/**
 * @file SurrealDB 客户端
 * @description API Server Utility Process 中使用的 SurrealDB 客户端
 */

import { SurrealDBQueryService } from '@shared-utils/surrealdb-query'
import type { ApiServerDBConfig } from '@shared/api-server.types'

// ============================================================================
// 日志
// ============================================================================

const log = (msg: string, data?: any): void => {
  if (data) {
    console.log(`[ApiServer:SurrealClient] ${msg}`, data)
  } else {
    console.log(`[ApiServer:SurrealClient] ${msg}`)
  }
}

const logError = (msg: string, error?: any): void => {
  console.error(`[ApiServer:SurrealClient] ${msg}`, error)
}

// ============================================================================
// SurrealClient
// ============================================================================

export class SurrealClient {
  private queryService: SurrealDBQueryService
  private connected = false
  private config?: ApiServerDBConfig

  constructor() {
    this.queryService = new SurrealDBQueryService()
    // 禁用操作日志记录（API Server 不需要写入 operation_log）
    this.queryService.setLogging(false)
  }

  // ==========================================================================
  // 连接管理
  // ==========================================================================

  async connect(config: ApiServerDBConfig): Promise<void> {
    if (this.connected) {
      await this.disconnect()
    }

    this.config = config

    try {
      await this.queryService.connect(config.serverUrl, {
        username: config.username,
        password: config.password,
        namespace: config.namespace,
        database: 'system' // 默认连接到 system 数据库
      })

      this.connected = true
      log('Connected', {
        serverUrl: config.serverUrl,
        namespace: config.namespace
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

  getNamespace(): string {
    return this.config?.namespace || 'knowledge'
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

/**
 * @file 搬运工作器
 * @description 将暂存表数据搬运到目标向量表
 */

import type { SurrealClient } from '../db/surreal-client'
import type { GroupedRecords, StagingRecord } from './staging-poller'
import type { IndexerConfig } from '@shared/vector-indexer-ipc.types'

// ============================================================================
// 日志
// ============================================================================

const log = (msg: string, data?: any): void => {
  if (data) {
    console.log(`[TransferWorker] ${msg}`, data)
  } else {
    console.log(`[TransferWorker] ${msg}`)
  }
}

const logError = (msg: string, error?: any): void => {
  console.error(`[TransferWorker] ${msg}`, error)
}

// ============================================================================
// 常量
// ============================================================================

/** 暂存表所在的 namespace */
const STAGING_NAMESPACE = 'knowledge'
/** 暂存表所在的 database */
const STAGING_DATABASE = 'system'
/** 暂存表名 */
const STAGING_TABLE = 'vector_staging'
/** 每批插入的记录数 */
const INSERT_BATCH_SIZE = 100

// ============================================================================
// 回调类型
// ============================================================================

export interface TransferCallbacks {
  onBatchCompleted?: (tableName: string, count: number, duration: number) => void
  onError?: (message: string, details?: string) => void
  onProgress?: (transferred: number, pending: number, activeTableCount: number) => void
}

// ============================================================================
// TransferWorker
// ============================================================================

export class TransferWorker {
  private client: SurrealClient
  private config: IndexerConfig
  private callbacks: TransferCallbacks
  private activeTransfers = new Set<string>()
  private tableCache = new Set<string>()
  private totalTransferred = 0

  constructor(client: SurrealClient, config: IndexerConfig, callbacks: TransferCallbacks = {}) {
    this.client = client
    this.config = config
    this.callbacks = callbacks
  }

  // ==========================================================================
  // 配置
  // ==========================================================================

  updateConfig(config: Partial<IndexerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  // ==========================================================================
  // 统计
  // ==========================================================================

  getTotalTransferred(): number {
    return this.totalTransferred
  }

  getActiveTableCount(): number {
    return this.activeTransfers.size
  }

  // ==========================================================================
  // 核心处理
  // ==========================================================================

  /**
   * 处理分组后的记录
   * 并行处理最多 maxConcurrentTables 个表
   */
  async processGroups(groups: GroupedRecords[]): Promise<void> {
    if (groups.length === 0) return

    // 限制并发数
    const maxConcurrent = this.config.maxConcurrentTables
    const availableSlots = maxConcurrent - this.activeTransfers.size

    if (availableSlots <= 0) {
      log('All slots occupied, skipping this batch')
      return
    }

    // 选择要处理的分组（优先处理记录数多的）
    const sortedGroups = [...groups].sort((a, b) => b.records.length - a.records.length)
    const groupsToProcess = sortedGroups
      .filter((g) => !this.activeTransfers.has(g.targetKey))
      .slice(0, availableSlots)

    if (groupsToProcess.length === 0) {
      log('No groups to process (all targets are busy)')
      return
    }

    log(`Processing ${groupsToProcess.length} groups`, {
      tables: groupsToProcess.map((g) => g.tableName),
      totalRecords: groupsToProcess.reduce((sum, g) => sum + g.records.length, 0)
    })

    // 并行处理
    const promises = groupsToProcess.map((group) => this.processGroup(group))
    await Promise.allSettled(promises)
  }

  /**
   * 处理单个分组
   */
  private async processGroup(group: GroupedRecords): Promise<void> {
    const { targetKey, namespace, database, tableName, dimensions, records } = group

    // 标记为活跃
    this.activeTransfers.add(targetKey)
    const startTime = Date.now()

    try {
      // Step 1: 标记 processing_started_at
      await this.markProcessingStarted(records.map((r) => r.id))

      // Step 2: 确保目标表存在
      await this.ensureTargetTable(namespace, database, tableName, dimensions)

      // Step 3: 分批插入目标表（使用 UPSERT 保证幂等）
      await this.insertToTargetTable(namespace, database, tableName, records)

      // Step 4: 标记 processed = true
      await this.markProcessed(records.map((r) => r.id))

      const duration = Date.now() - startTime
      this.totalTransferred += records.length

      log(`Group completed`, {
        tableName,
        count: records.length,
        duration: `${duration}ms`
      })

      this.callbacks.onBatchCompleted?.(tableName, records.length, duration)
      this.callbacks.onProgress?.(
        this.totalTransferred,
        0, // 待处理数需要从 poller 获取
        this.activeTransfers.size
      )
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logError(`Group failed: ${tableName}`, msg)
      this.callbacks.onError?.(
        `Transfer failed for ${tableName}`,
        msg
      )
      // 不标记 processed，让超时机制重试
    } finally {
      this.activeTransfers.delete(targetKey)
    }
  }

  // ==========================================================================
  // 暂存表操作
  // ==========================================================================

  /**
   * 标记记录开始处理
   */
  private async markProcessingStarted(ids: string[]): Promise<void> {
    if (ids.length === 0) return

    const sql = `
      UPDATE ${STAGING_TABLE}
      SET processing_started_at = time::now()
      WHERE id IN $ids;
    `

    await this.client.queryInDatabase(
      STAGING_NAMESPACE,
      STAGING_DATABASE,
      sql,
      { ids }
    )
  }

  /**
   * 标记记录已处理
   */
  private async markProcessed(ids: string[]): Promise<void> {
    if (ids.length === 0) return

    const sql = `
      UPDATE ${STAGING_TABLE}
      SET processed = true, processing_started_at = NULL
      WHERE id IN $ids;
    `

    await this.client.queryInDatabase(
      STAGING_NAMESPACE,
      STAGING_DATABASE,
      sql,
      { ids }
    )
  }

  // ==========================================================================
  // 目标表操作
  // ==========================================================================

  /**
   * 确保目标表存在（含 HNSW 索引）
   */
  private async ensureTargetTable(
    namespace: string,
    database: string,
    tableName: string,
    dimensions: number
  ): Promise<void> {
    const cacheKey = `${namespace}.${database}.${tableName}`
    if (this.tableCache.has(cacheKey)) {
      return
    }

    const sql = `
      DEFINE TABLE IF NOT EXISTS \`${tableName}\`;
      DEFINE INDEX IF NOT EXISTS uniq_doc_chunk
        ON TABLE \`${tableName}\` FIELDS document, chunk_index UNIQUE;
      DEFINE INDEX IF NOT EXISTS hnsw_embedding
        ON TABLE \`${tableName}\` FIELDS embedding
        HNSW DIMENSION ${dimensions} DIST COSINE TYPE F32 EFC 200 M 16;
    `

    try {
      await this.client.queryInDatabase(namespace, database, sql)
      this.tableCache.add(cacheKey)
      log(`Ensured target table: ${tableName}`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      // 如果表/索引已存在，视为成功
      if (!msg.includes('already exists')) {
        throw error
      }
      this.tableCache.add(cacheKey)
    }
  }

  /**
   * 分批插入目标表
   * 使用 UPSERT 保证幂等性
   */
  private async insertToTargetTable(
    namespace: string,
    database: string,
    tableName: string,
    records: StagingRecord[]
  ): Promise<void> {
    const totalBatches = Math.ceil(records.length / INSERT_BATCH_SIZE)

    for (let i = 0; i < totalBatches; i++) {
      const start = i * INSERT_BATCH_SIZE
      const end = Math.min(start + INSERT_BATCH_SIZE, records.length)
      const batch = records.slice(start, end)

      // 构建批量 UPSERT 数据
      const chunkData = batch.map((record) => ({
        document: record.document_id,
        chunk_index: record.chunk_index,
        content: record.content,
        char_count: record.char_count,
        start_char: record.start_char,
        end_char: record.end_char,
        embedding: record.embedding,
        file_key: record.file_key,
        file_name: record.file_name
      }))

      // 使用 INSERT 配合 UNIQUE 索引保证幂等
      // 如果记录已存在会报错，但不影响数据完整性
      const sql = `INSERT IGNORE INTO \`${tableName}\` $chunks;`

      try {
        await this.client.queryInDatabase(namespace, database, sql, { chunks: chunkData })
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        // 如果是重复键错误，忽略（幂等处理）
        if (!msg.includes('already exists') && !msg.includes('unique')) {
          throw error
        }
        log(`Some records already exist in ${tableName}, continuing...`)
      }
    }
  }
}

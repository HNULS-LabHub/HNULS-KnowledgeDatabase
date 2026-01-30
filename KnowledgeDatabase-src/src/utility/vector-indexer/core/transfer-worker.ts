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
const INSERT_BATCH_SIZE = 500

// ============================================================================
// 回调类型
// ============================================================================

/** 文档嵌入完成信息 */
export interface DocumentEmbeddedInfo {
  targetNamespace: string
  targetDatabase: string
  documentId: string
  fileKey: string
  embeddingConfigId: string
  dimensions: number
  chunkCount: number
}

export interface TransferCallbacks {
  onBatchCompleted?: (tableName: string, count: number, duration: number) => void
  onError?: (message: string, details?: string) => void
  onProgress?: (transferred: number, pending: number, activeTableCount: number) => void
  /** 文档嵌入完成回调（每个文档完成后触发） */
  onDocumentEmbedded?: (info: DocumentEmbeddedInfo) => void
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

      // Step 3: 删除可能冲突的旧向量（按 document+chunk_index 精确删除）
      await this.deleteConflictingVectors(namespace, database, tableName, records)

      // Step 4: 分批插入目标表
      await this.insertToTargetTable(namespace, database, tableName, records)

      // Step 5: 清理暂存表（先标记已处理，再删除）
      const recordIds = records.map((r) => r.id)
      await this.markProcessed(recordIds)
      await this.deleteProcessedRecords(recordIds)

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

      // 🎯 统计每个文档的 chunk 数量并发送嵌入完成通知
      this.notifyDocumentsEmbedded(group)
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
   * 先标记再删除，确保删除失败时不会重复处理
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

  /**
   * 删除已处理的暂存记录
   * 索引成功后清理暂存表，释放存储空间
   */
  private async deleteProcessedRecords(ids: string[]): Promise<void> {
    if (ids.length === 0) return

    const sql = `
      DELETE FROM ${STAGING_TABLE}
      WHERE id IN $ids;
    `

    try {
      await this.client.queryInDatabase(
        STAGING_NAMESPACE,
        STAGING_DATABASE,
        sql,
        { ids }
      )
      log(`Cleaned up ${ids.length} staging records`)
    } catch (error) {
      // 删除失败不影响主流程，记录警告即可
      // 因为已经标记 processed=true，下次轮询不会重复处理
      const msg = error instanceof Error ? error.message : String(error)
      console.warn(`[TransferWorker] Failed to cleanup staging records: ${msg}`)
    }
  }

  // ==========================================================================
  // 目标表操作
  // ==========================================================================

  /**
   * 删除可能冲突的旧向量
   * 精确按 (document, chunk_index) 组合删除，避免误删其他批次已插入的数据
   */
  private async deleteConflictingVectors(
    namespace: string,
    database: string,
    tableName: string,
    records: StagingRecord[]
  ): Promise<void> {
    if (records.length === 0) return

    // 构建待删除的 (document, chunk_index) 组合
    const pairs = records.map((r) => [r.document_id, r.chunk_index])

    log(`Deleting ${pairs.length} potentially conflicting vectors in ${tableName}`)

    // 批量删除：使用 OR 条件匹配每个 (document, chunk_index) 组合
    // 分批处理以避免 SQL 过长
    const BATCH_SIZE = 100
    for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
      const batch = pairs.slice(i, i + BATCH_SIZE)
      const conditions = batch
        .map((_, idx) => `(document = $doc${idx} AND chunk_index = $idx${idx})`)
        .join(' OR ')

      const params: Record<string, any> = {}
      batch.forEach(([doc, idx], i) => {
        params[`doc${i}`] = doc
        params[`idx${i}`] = idx
      })

      const sql = `DELETE FROM \`${tableName}\` WHERE ${conditions};`

      try {
        await this.client.queryInDatabase(namespace, database, sql, params)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        // 如果表不存在（首次创建），忽略删除错误
        if (!msg.includes('not found') && !msg.includes('does not exist')) {
          logError(`Failed to delete conflicting vectors from ${tableName}`, msg)
          // 不抛出错误，继续尝试插入
        }
      }
    }
  }

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

      // 使用 INSERT（已删除冲突数据）
      const sql = `INSERT INTO \`${tableName}\` $chunks;`
      await this.client.queryInDatabase(namespace, database, sql, { chunks: chunkData })
    }
  }

  // ==========================================================================
  // 文档嵌入完成通知
  // ==========================================================================

  /**
   * 统计每个文档的 chunk 数量并发送嵌入完成通知
   */
  private notifyDocumentsEmbedded(group: GroupedRecords): void {
    if (!this.callbacks.onDocumentEmbedded) return

    // 按文档分组统计 chunk 数量
    const documentChunkCounts = new Map<string, {
      fileKey: string
      chunkCount: number
    }>()

    for (const record of group.records) {
      const existing = documentChunkCounts.get(record.document_id)
      if (existing) {
        existing.chunkCount++
      } else {
        documentChunkCounts.set(record.document_id, {
          fileKey: record.file_key,
          chunkCount: 1
        })
      }
    }

    // 为每个文档发送嵌入完成通知
    for (const [documentId, info] of documentChunkCounts) {
      this.callbacks.onDocumentEmbedded({
        targetNamespace: group.namespace,
        targetDatabase: group.database,
        documentId,
        fileKey: info.fileKey,
        embeddingConfigId: group.embeddingConfigId,
        dimensions: group.dimensions,
        chunkCount: info.chunkCount
      })
    }
  }
}

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
  runId?: string
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
  private finalizedRuns = new Set<string>()
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
   * 串行处理记录数最多的 1 个 group（≤batchSize 条）
   */
  async processGroups(groups: GroupedRecords[]): Promise<void> {
    if (groups.length === 0) return

    // 按记录数降序，取最大的 group
    const sorted = [...groups].sort((a, b) => b.records.length - a.records.length)
    const biggest = sorted[0]

    // 最多取 batchSize 条（默认 100）
    const limit = this.config.batchSize
    const records = biggest.records.slice(0, limit)

    const subGroup: GroupedRecords = {
      ...biggest,
      records
    }

    log(`Processing group`, {
      table: subGroup.tableName,
      records: records.length,
      totalPending: biggest.records.length
    })

    await this.processGroup(subGroup)
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

      // Step 5: run 级替换（完整 run 到齐后清理旧 run）
      await this.reconcileCompletedRuns(group)

      // Step 6: 标记已处理（不立即删除，留给 idle 时批量清理）
      const recordIds = records.map((r) => r.id)
      await this.markProcessed(recordIds)

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
      this.callbacks.onError?.(`Transfer failed for ${tableName}`, msg)
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
      WHERE id IN $ids
      RETURN NONE;
    `

    await this.client.queryInDatabase(STAGING_NAMESPACE, STAGING_DATABASE, sql, { ids })
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
      WHERE id IN $ids
      RETURN NONE;
    `

    await this.client.queryInDatabase(STAGING_NAMESPACE, STAGING_DATABASE, sql, { ids })
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

      const sql = `DELETE FROM \`${tableName}\` WHERE ${conditions} RETURN NONE;`

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
        file_name: record.file_name,
        run_id: record.run_id,
        run_total_chunks: record.run_total_chunks
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
   * run 级替换：当某个 fileKey+runId 的行数达到 run_total_chunks 时，
   * 认为新 run 完整，删除同 fileKey 下旧 run 数据并发送完成通知。
   */
  private async reconcileCompletedRuns(group: GroupedRecords): Promise<void> {
    if (!this.callbacks.onDocumentEmbedded) return

    const runEntries = new Map<
      string,
      {
        documentId: string
        fileKey: string
        runId: string
        runTotalChunks: number
      }
    >()

    for (const record of group.records) {
      const runId = String(record.run_id ?? '').trim()
      const runTotalChunks = Number(record.run_total_chunks ?? 0)
      if (!runId || !record.file_key || !Number.isFinite(runTotalChunks) || runTotalChunks <= 0) {
        continue
      }

      const key = `${record.document_id}::${record.file_key}::${runId}`
      const existing = runEntries.get(key)
      if (!existing || runTotalChunks > existing.runTotalChunks) {
        runEntries.set(key, {
          documentId: record.document_id,
          fileKey: record.file_key,
          runId,
          runTotalChunks
        })
      }
    }

    // 兼容旧数据：若暂存记录无 run 元信息，则回退到旧逻辑（按批次通知）
    if (runEntries.size === 0) {
      this.notifyLegacyDocumentsEmbedded(group)
      return
    }

    for (const entry of runEntries.values()) {
      const finalizedKey = `${group.namespace}.${group.database}.${group.tableName}.${entry.fileKey}.${entry.runId}`
      if (this.finalizedRuns.has(finalizedKey)) {
        continue
      }

      const countSql = `
        SELECT count() AS count
        FROM \`${group.tableName}\`
        WHERE file_key = $fileKey AND run_id = $runId
        GROUP ALL;
      `
      const countResult = await this.client.queryInDatabase(group.namespace, group.database, countSql, {
        fileKey: entry.fileKey,
        runId: entry.runId
      })
      const countRows = this.client.extractRecords(countResult)
      const runCount = Number(countRows[0]?.count ?? 0)

      if (!Number.isFinite(runCount) || runCount < 0) {
        throw new Error(
          `Invalid run count for ${group.tableName} fileKey=${entry.fileKey} runId=${entry.runId}: ${String(
            countRows[0]?.count
          )}`
        )
      }

      // 当前 run 还没到齐，等待后续批次
      if (runCount < entry.runTotalChunks) {
        continue
      }

      if (runCount > entry.runTotalChunks) {
        throw new Error(
          `Run count overflow for ${group.tableName} fileKey=${entry.fileKey} runId=${entry.runId}: ${runCount} > ${entry.runTotalChunks}`
        )
      }

      // 新 run 已完整：清理同 fileKey 下旧 run（包含无 run_id 的历史数据）
      const cleanupSql = `
        DELETE FROM \`${group.tableName}\`
        WHERE file_key = $fileKey
          AND (run_id != $runId OR run_id = NONE)
        RETURN NONE;
      `
      await this.client.queryInDatabase(group.namespace, group.database, cleanupSql, {
        fileKey: entry.fileKey,
        runId: entry.runId
      })

      this.finalizedRuns.add(finalizedKey)

      this.callbacks.onDocumentEmbedded({
        targetNamespace: group.namespace,
        targetDatabase: group.database,
        documentId: entry.documentId,
        fileKey: entry.fileKey,
        runId: entry.runId,
        embeddingConfigId: group.embeddingConfigId,
        dimensions: group.dimensions,
        chunkCount: runCount
      })

      log('Run replacement completed', {
        tableName: group.tableName,
        fileKey: entry.fileKey,
        runId: entry.runId,
        chunkCount: runCount
      })
    }
  }

  private notifyLegacyDocumentsEmbedded(group: GroupedRecords): void {
    if (!this.callbacks.onDocumentEmbedded) return

    const documentChunkCounts = new Map<
      string,
      {
        fileKey: string
        chunkCount: number
      }
    >()

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

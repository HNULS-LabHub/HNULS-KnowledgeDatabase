/**
 * @file 向量暂存服务
 * @description 用于流式写入嵌入向量到 system.vector_staging 暂存表
 */

import type { VectorStagingRecord } from '@shared/embedding.types'
import type { QueryService } from '../surrealdb-service'
import { logger } from '../logger'

// ============================================================================
// 配置常量
// ============================================================================

/** 暂存表所在的 namespace */
const STAGING_NAMESPACE = 'knowledge'
/** 暂存表所在的 database */
const STAGING_DATABASE = 'system'
/** 暂存表名 */
const STAGING_TABLE = 'vector_staging'
/** 批量插入大小 - 向量数据较大，需要小批量避免连接超时 */
const BATCH_INSERT_SIZE = 100
/** 重试次数 */
const MAX_RETRIES = 3
/** 重试间隔(ms) */
const RETRY_DELAY = 1000

// ============================================================================
// VectorStagingService
// ============================================================================

export class VectorStagingService {
  private queryService?: QueryService
  private tableInitialized = false

  // ==========================================================================
  // 依赖注入
  // ==========================================================================

  setQueryService(queryService: QueryService): void {
    this.queryService = queryService
  }

  // ==========================================================================
  // 表初始化
  // ==========================================================================

  /**
   * 确保暂存表存在
   */
  async ensureTable(): Promise<void> {
    if (this.tableInitialized) return
    if (!this.queryService?.isConnected()) {
      throw new Error('QueryService not available for VectorStagingService.ensureTable')
    }

    try {
      const sql = `
        DEFINE TABLE IF NOT EXISTS ${STAGING_TABLE} SCHEMALESS;
        DEFINE INDEX IF NOT EXISTS idx_staging_processed ON ${STAGING_TABLE} FIELDS processed;
      `
      await this.queryService.queryInDatabase(STAGING_NAMESPACE, STAGING_DATABASE, sql)
      this.tableInitialized = true
      logger.info('[VectorStagingService] Staging table ensured', {
        namespace: STAGING_NAMESPACE,
        database: STAGING_DATABASE,
        table: STAGING_TABLE
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      // 如果表已存在，视为成功
      if (!msg.includes('already exists')) {
        logger.error('[VectorStagingService] Failed to ensure staging table', { error: msg })
        throw error
      }
      this.tableInitialized = true
    }
  }

  // ==========================================================================
  // 写入操作
  // ==========================================================================

  /**
   * 写入单条暂存记录
   */
  async insert(record: VectorStagingRecord): Promise<void> {
    await this.ensureTable()
    if (!this.queryService?.isConnected()) {
      throw new Error('QueryService not available for VectorStagingService.insert')
    }

    try {
      await this.queryService.queryInDatabase(
        STAGING_NAMESPACE,
        STAGING_DATABASE,
        `INSERT INTO ${STAGING_TABLE} $record;`,
        { record }
      )
      logger.debug('[VectorStagingService] Inserted staging record', {
        documentId: record.document_id,
        chunkIndex: record.chunk_index
      })
    } catch (error) {
      logger.error('[VectorStagingService] Failed to insert staging record', {
        documentId: record.document_id,
        chunkIndex: record.chunk_index,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * 批量写入暂存记录
   */
  async insertBatch(records: VectorStagingRecord[]): Promise<void> {
    if (records.length === 0) return
    await this.ensureTable()
    if (!this.queryService?.isConnected()) {
      throw new Error('QueryService not available for VectorStagingService.insertBatch')
    }

    const totalRecords = records.length
    const totalBatches = Math.ceil(totalRecords / BATCH_INSERT_SIZE)

    logger.info('[VectorStagingService] Starting batch insert', {
      totalRecords,
      totalBatches,
      batchSize: BATCH_INSERT_SIZE
    })

    for (let i = 0; i < totalBatches; i++) {
      const start = i * BATCH_INSERT_SIZE
      const end = Math.min(start + BATCH_INSERT_SIZE, totalRecords)
      const batch = records.slice(start, end)

      let lastError: Error | null = null
      for (let retry = 0; retry < MAX_RETRIES; retry++) {
        try {
          const startTime = Date.now()
          await this.queryService.queryInDatabase(
            STAGING_NAMESPACE,
            STAGING_DATABASE,
            `INSERT INTO ${STAGING_TABLE} $records;`,
            { records: batch }
          )
          const duration = Date.now() - startTime

          logger.debug('[VectorStagingService] Batch inserted', {
            batchNum: i + 1,
            totalBatches,
            batchSize: batch.length,
            duration: `${duration}ms`,
            retry: retry > 0 ? retry : undefined
          })
          lastError = null
          break
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))
          if (retry < MAX_RETRIES - 1) {
            logger.warn('[VectorStagingService] Batch insert failed, retrying...', {
              batchNum: i + 1,
              retry: retry + 1,
              error: lastError.message
            })
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * (retry + 1)))
          }
        }
      }
      if (lastError) {
        logger.error('[VectorStagingService] Batch insert failed after retries', {
          batchNum: i + 1,
          totalBatches,
          error: lastError.message
        })
        throw lastError
      }
    }

    logger.info('[VectorStagingService] Batch insert completed', {
      totalRecords,
      totalBatches
    })
  }
}

// 单例导出
export const vectorStagingService = new VectorStagingService()

/**
 * @file 暂存表轮询器
 * @description 定时从 system.vector_staging 表获取未处理的记录
 */

import type { SurrealClient } from '../db/surreal-client'
import type { VectorStagingRecord } from '@shared/embedding.types'
import type { IndexerConfig, StagingStatus } from '@shared/vector-indexer-ipc.types'

// ============================================================================
// 日志
// ============================================================================

const log = (msg: string, data?: any): void => {
  if (data) {
    console.log(`[StagingPoller] ${msg}`, data)
  } else {
    console.log(`[StagingPoller] ${msg}`)
  }
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

// ============================================================================
// 类型
// ============================================================================

export interface StagingRecord extends VectorStagingRecord {
  id: string
}

export interface GroupedRecords {
  /** 目标表标识: `${namespace}.${database}.${tableName}` */
  targetKey: string
  /** 目标 namespace */
  namespace: string
  /** 目标 database */
  database: string
  /** 目标表名 (emb_cfg_xxx_xxx_chunks) */
  tableName: string
  /** 嵌入配置 ID */
  embeddingConfigId: string
  /** 向量维度 */
  dimensions: number
  /** 记录列表 */
  records: StagingRecord[]
}

// ============================================================================
// StagingPoller
// ============================================================================

export class StagingPoller {
  private client: SurrealClient
  private config: IndexerConfig
  private timer: ReturnType<typeof setTimeout> | null = null
  private isRunning = false
  private onRecordsCallback?: (groups: GroupedRecords[]) => Promise<void>
  private onCleanupCallback?: (message: string) => void

  constructor(client: SurrealClient, config: IndexerConfig) {
    this.client = client
    this.config = config
  }

  // ==========================================================================
  // 生命周期
  // ==========================================================================

  /**
   * 启动轮询
   * @param onRecords 当获取到记录时的回调
   */
  start(
    onRecords: (groups: GroupedRecords[]) => Promise<void>,
    onCleanup?: (message: string) => void
  ): void {
    if (this.isRunning) {
      log('Already running')
      return
    }

    this.isRunning = true
    this.onRecordsCallback = onRecords
    this.onCleanupCallback = onCleanup
    log('Started')
    this.scheduleNextPoll(0) // 立即执行第一次
  }

  stop(): void {
    this.isRunning = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    log('Stopped')
  }

  updateConfig(config: Partial<IndexerConfig>): void {
    this.config = { ...this.config, ...config }
    log('Config updated', this.config)
  }

  // ==========================================================================
  // 轮询逻辑
  // ==========================================================================

  private scheduleNextPoll(delay: number): void {
    if (!this.isRunning) return

    this.timer = setTimeout(async () => {
      await this.poll()
    }, delay)
  }

  private async poll(): Promise<void> {
    if (!this.isRunning) return

    try {
      const records = await this.fetchUnprocessedRecords()

      if (records.length === 0) {
        // 无待处理数据 → 批量清理已处理记录，再进入 idle
        await this.cleanupProcessedRecords()
        this.scheduleNextPoll(this.config.pollIntervalIdle)
        return
      }

      log(`Fetched ${records.length} unprocessed records`)

      // 按目标表分组
      const groups = this.groupByTargetTable(records)

      // 调用回调处理
      if (this.onRecordsCallback) {
        await this.onRecordsCallback(groups)
      }

      // 有数据，使用较短的轮询间隔
      this.scheduleNextPoll(this.config.pollIntervalActive)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error('[StagingPoller] Poll error:', msg)
      // 出错后等待较长时间再重试
      this.scheduleNextPoll(this.config.pollIntervalIdle)
    }
  }

  // ==========================================================================
  // 数据获取
  // ==========================================================================

  /**
   * 获取未处理的记录
   * - processed = false
   * - processing_started_at IS NULL 或者已超时
   */
  private async fetchUnprocessedRecords(): Promise<StagingRecord[]> {
    const timeoutMs = this.config.processingTimeout
    const timeoutSeconds = Math.floor(timeoutMs / 1000)

    // SurrealDB 时间运算使用 duration 格式
    const sql = `
      SELECT * FROM ${STAGING_TABLE}
      WHERE processed = false
        AND (
          processing_started_at IS NULL
          OR processing_started_at < time::now() - ${timeoutSeconds}s
        )
      LIMIT $limit;
    `

    const result = await this.client.queryInDatabase(STAGING_NAMESPACE, STAGING_DATABASE, sql, {
      limit: this.config.batchSize
    })

    return this.client.extractRecords(result) as StagingRecord[]
  }

  // ==========================================================================
  // 数据分组
  // ==========================================================================

  /**
   * 按目标表分组
   */
  private groupByTargetTable(records: StagingRecord[]): GroupedRecords[] {
    const groupMap = new Map<string, GroupedRecords>()

    for (const record of records) {
      const tableName = this.getChunksTableName(record.embedding_config_id, record.dimensions)
      const targetKey = `${record.target_namespace}.${record.target_database}.${tableName}`

      let group = groupMap.get(targetKey)
      if (!group) {
        group = {
          targetKey,
          namespace: record.target_namespace,
          database: record.target_database,
          tableName,
          embeddingConfigId: record.embedding_config_id,
          dimensions: record.dimensions,
          records: []
        }
        groupMap.set(targetKey, group)
      }

      group.records.push(record)
    }

    return Array.from(groupMap.values())
  }

  /**
   * 生成目标表名
   */
  private getChunksTableName(configId: string, dimensions: number): string {
    const safeId = configId.replace(/[^a-zA-Z0-9_]/g, '_')
    return `emb_cfg_${safeId}_${dimensions}_chunks`
  }

  // ==========================================================================
  // 暂存表清理
  // ==========================================================================

  /**
   * 批量删除已处理的暂存记录
   * 在切换 idle 之前调用，保持暂存表干净
   * 
   * ⚠️ 策略：直接 REMOVE TABLE + 重建，避免逐条 DELETE 大向量记录导致 payload 过大
   */
  private async cleanupProcessedRecords(): Promise<void> {
    try {
      const msg1 = 'Entering idle state, cleaning up staging table...'
      log(msg1)
      this.onCleanupCallback?.(msg1)
      
      // 🔥 直接删表重建（比 DELETE 快且不会返回大向量数据）
      // 不用查 count，直接 REMOVE 就行，即使表为空也没影响
      const sql = `
        REMOVE TABLE IF EXISTS ${STAGING_TABLE};
        DEFINE TABLE IF NOT EXISTS ${STAGING_TABLE} SCHEMALESS;
        DEFINE INDEX IF NOT EXISTS idx_staging_processed ON ${STAGING_TABLE} FIELDS processed;
      `
      await this.client.queryInDatabase(STAGING_NAMESPACE, STAGING_DATABASE, sql)
      
      const msg2 = 'Successfully cleaned up staging table (drop + recreate)'
      log(msg2)
      this.onCleanupCallback?.(msg2)
    } catch (error) {
      // queryInDatabase 内部已经打印了详细错误日志，这里只记录高层信息
      const errorMsg = `Failed to cleanup: ${error instanceof Error ? error.message : String(error)}`
      console.error('[StagingPoller]', errorMsg)
      this.onCleanupCallback?.(errorMsg)
      // 重要：不 throw，让 poll 继续运行
    }
  }

  // ==========================================================================
  // 暂存表状态查询
  // ==========================================================================

  /**
   * 查询暂存表状态
   * @returns 暂存表状态信息
   */
  async getStagingStatus(): Promise<StagingStatus> {
    try {
      // 使用单条 SQL 查询所有统计信息
      const sql = `
        SELECT
          count() AS total,
          count(processed = true) AS processed_count,
          count(processed = false) AS pending_count,
          count(processing_started_at != NULL AND processed = false) AS processing_count
        FROM ${STAGING_TABLE}
        GROUP ALL;
      `

      const result = await this.client.queryInDatabase(STAGING_NAMESPACE, STAGING_DATABASE, sql)

      const records = this.client.extractRecords(result)
      const row = records[0] || {}

      const total = Number(row.total) || 0
      const processed = Number(row.processed_count) || 0
      const pending = Number(row.pending_count) || 0
      const processing = Number(row.processing_count) || 0

      // 进入 idle 前强制清表（仅在确实有数据时触发）
      if (pending === 0 && total > 0) {
        await this.cleanupProcessedRecords()
        return {
          state: 'idle',
          total: 0,
          processed: 0,
          pending: 0,
          progress: null,
          processing: 0
        }
      }

      // 计算进度比例
      let progress: number | null = null
      if (total > 0) {
        progress = processed / total
      }

      // 确定状态: 有待处理数据则为 active，否则为 idle
      const state: 'active' | 'idle' = pending > 0 ? 'active' : 'idle'

      return {
        state,
        total,
        processed,
        pending,
        progress,
        processing
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error('[StagingPoller] Failed to get staging status:', msg)

      // 返回默认静息状态
      return {
        state: 'idle',
        total: 0,
        processed: 0,
        pending: 0,
        progress: null,
        processing: 0
      }
    }
  }
}

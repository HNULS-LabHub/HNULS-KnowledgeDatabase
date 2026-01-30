/**
 * @file 暂存表轮询器
 * @description 定时从 system.vector_staging 表获取未处理的记录
 */

import type { SurrealClient } from '../db/surreal-client'
import type { VectorStagingRecord } from '@shared/embedding.types'
import type { IndexerConfig } from '@shared/vector-indexer-ipc.types'

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
  start(onRecords: (groups: GroupedRecords[]) => Promise<void>): void {
    if (this.isRunning) {
      log('Already running')
      return
    }

    this.isRunning = true
    this.onRecordsCallback = onRecords
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
        // 无数据，使用较长的轮询间隔
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

    const result = await this.client.queryInDatabase(
      STAGING_NAMESPACE,
      STAGING_DATABASE,
      sql,
      { limit: this.config.batchSize }
    )

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
      const tableName = this.getChunksTableName(
        record.embedding_config_id,
        record.dimensions
      )
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
}

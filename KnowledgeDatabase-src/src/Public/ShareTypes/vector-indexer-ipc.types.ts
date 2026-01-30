/**
 * @file Vector Indexer IPC 消息协议
 * @description 定义 Main ↔ Vector Indexer (Utility Process) 之间的消息类型
 */

// ============================================================================
// 配置类型
// ============================================================================

/**
 * SurrealDB 连接配置
 */
export interface IndexerDBConfig {
  serverUrl: string
  username: string
  password: string
  namespace: string
  database: string
}

/**
 * Indexer 运行配置
 */
export interface IndexerConfig {
  /** 每次获取的最大记录数 */
  batchSize: number
  /** 最大并行处理的目标表数 */
  maxConcurrentTables: number
  /** 轮询间隔（毫秒）- 有数据时 */
  pollIntervalActive: number
  /** 轮询间隔（毫秒）- 无数据时 */
  pollIntervalIdle: number
  /** 处理超时时间（毫秒）*/
  processingTimeout: number
}

/**
 * 默认配置
 */
export const DEFAULT_INDEXER_CONFIG: IndexerConfig = {
  batchSize: 4000,
  maxConcurrentTables: 5,
  pollIntervalActive: 1000,
  pollIntervalIdle: 5000,
  processingTimeout: 5 * 60 * 1000 // 5 分钟
}

// ============================================================================
// 统计信息
// ============================================================================

/**
 * Indexer 统计信息
 */
export interface IndexerStats {
  /** 已搬运的记录总数 */
  totalTransferred: number
  /** 当前批次已处理数 */
  currentBatchProcessed: number
  /** 当前批次总数 */
  currentBatchTotal: number
  /** 正在处理的表数 */
  activeTableCount: number
  /** 上次轮询时间 */
  lastPollTime: number
  /** 是否处于活跃状态 */
  isActive: boolean
}

// ============================================================================
// Main → Indexer 消息
// ============================================================================

export type MainToIndexerMessage =
  | {
      type: 'indexer:start'
      dbConfig: IndexerDBConfig
      config?: Partial<IndexerConfig>
    }
  | { type: 'indexer:stop' }
  | { type: 'indexer:config'; config: Partial<IndexerConfig> }
  | { type: 'indexer:query-stats'; requestId: string }

// ============================================================================
// Indexer → Main 消息
// ============================================================================

export type IndexerToMainMessage =
  | { type: 'indexer:ready' }
  | {
      type: 'indexer:started'
    }
  | {
      type: 'indexer:stopped'
    }
  | {
      type: 'indexer:progress'
      transferred: number
      pending: number
      activeTableCount: number
    }
  | {
      type: 'indexer:batch-completed'
      tableName: string
      count: number
      duration: number
    }
  | {
      type: 'indexer:error'
      message: string
      details?: string
    }
  | {
      type: 'indexer:stats'
      requestId: string
      stats: IndexerStats
    }

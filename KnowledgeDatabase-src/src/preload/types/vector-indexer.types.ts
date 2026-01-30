/**
 * @file 向量索引器类型定义
 * @description 定义向量索引器相关的类型
 */

/**
 * 暂存表状态
 */
export interface StagingStatus {
  /** 状态: 'active' 有待处理数据 | 'idle' 静息 */
  state: 'active' | 'idle'
  /** 总记录数 */
  total: number
  /** 已处理记录数 (processed=true) */
  processed: number
  /** 待处理记录数 (processed=false) */
  pending: number
  /** 处理进度比例 (0-1)，无数据时为 null */
  progress: number | null
  /** 正在处理中的记录数 (processing_started_at 不为空) */
  processing: number
}

/**
 * 向量索引器 API
 */
export interface VectorIndexerAPI {
  /**
   * 获取暂存表状态
   */
  getStagingStatus(): Promise<StagingStatus | null>
}

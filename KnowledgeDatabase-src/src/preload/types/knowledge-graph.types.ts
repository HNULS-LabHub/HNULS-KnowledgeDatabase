/**
 * @file 知识图谱类型定义
 * @description 定义知识图谱构建相关的 Preload API 类型
 */

// 复用 ShareTypes 中已有的类型
import type {
  KGSubmitTaskParams,
  KGTaskStatus,
  KGTaskConfig,
  KGCreateSchemaParams,
  KGBuildTaskStatus,
  KGGraphQueryParams,
  KGGraphEntity,
  KGGraphRelation,
  KGGraphDataProgress,
  KGEmbeddingProgressData,
  KGRetrievalParams,
  KGRetrievalResult,
  KGRetrievalMode,
  KGRetrievalEntity,
  KGRetrievalRelation,
  KGRetrievalChunk,
  KGRetrievalMeta
} from '../../Public/ShareTypes/knowledge-graph-ipc.types'

// 重新导出供前端使用
export type {
  KGSubmitTaskParams,
  KGTaskStatus,
  KGTaskConfig,
  KGCreateSchemaParams,
  KGBuildTaskStatus,
  KGGraphQueryParams,
  KGGraphEntity,
  KGGraphRelation,
  KGGraphDataProgress,
  KGEmbeddingProgressData,
  KGRetrievalParams,
  KGRetrievalResult,
  KGRetrievalMode,
  KGRetrievalEntity,
  KGRetrievalRelation,
  KGRetrievalChunk,
  KGRetrievalMeta
}

/** 图谱数据批次事件 */
export interface GraphDataBatchEvent {
  sessionId: string
  entities: KGGraphEntity[]
  relations: KGGraphRelation[]
  progress: KGGraphDataProgress
}

/**
 * 知识图谱 API
 */
export interface KnowledgeGraphAPI {
  /**
   * 提交知识图谱构建任务
   */
  submitTask(params: KGSubmitTaskParams): Promise<{ taskId: string; chunksTotal: number }>

  /**
   * 查询所有任务状态
   */
  queryStatus(): Promise<KGTaskStatus[]>

  /**
   * 更新最大并行数
   */
  updateConcurrency(maxConcurrency: number): Promise<void>

  /**
   * 监听任务进度
   */
  onTaskProgress(
    callback: (taskId: string, completed: number, failed: number, total: number) => void
  ): () => void

  /**
   * 监听任务完成
   */
  onTaskCompleted(callback: (taskId: string) => void): () => void

  /**
   * 监听任务失败
   */
  onTaskFailed(callback: (taskId: string, error: string) => void): () => void

  /**
   * 创建图谱表 Schema
   */
  createGraphSchema(params: KGCreateSchemaParams): Promise<string[]>

  /**
   * 查询图谱构建任务状态
   */
  queryBuildStatus(): Promise<KGBuildTaskStatus[]>

  /**
   * 监听图谱构建进度
   */
  onBuildProgress(
    callback: (
      taskId: string,
      completed: number,
      failed: number,
      total: number,
      entitiesTotal: number,
      relationsTotal: number
    ) => void
  ): () => void

  /**
   * 监听图谱构建完成
   */
  onBuildCompleted(callback: (taskId: string) => void): () => void

  /**
   * 监听图谱构建失败
   */
  onBuildFailed(callback: (taskId: string, error: string) => void): () => void

  // ============================================================================
  // 图谱数据流式查询
  // ============================================================================

  /**
   * 查询图谱数据（流式）
   * @returns sessionId 用于后续取消或识别事件
   */
  queryGraphData(params: KGGraphQueryParams): Promise<string>

  /**
   * 取消图谱数据查询
   */
  cancelGraphQuery(sessionId: string): void

  /**
   * 监听图谱数据批次
   */
  onGraphDataBatch(callback: (data: GraphDataBatchEvent) => void): () => void

  /**
   * 监听图谱数据查询完成
   */
  onGraphDataComplete(callback: (sessionId: string) => void): () => void

  /**
   * 监听图谱数据查询错误
   */
  onGraphDataError(callback: (sessionId: string, error: string) => void): () => void

  /**
   * 监听图谱数据查询取消
   */
  onGraphDataCancelled(callback: (sessionId: string) => void): () => void

  // ============================================================================
  // KG 检索
  // ============================================================================

  /**
   * KG 检索（短过程 request-response，无进度事件）
   */
  retrievalSearch(params: KGRetrievalParams): Promise<KGRetrievalResult>

  // ============================================================================
  // 嵌入状态监控
  // ============================================================================

  /**
   * 查询嵌入调度器状态
   */
  queryEmbeddingStatus(): Promise<KGEmbeddingProgressData | null>

  /**
   * 监听嵌入进度事件
   */
  onEmbeddingProgress(callback: (data: KGEmbeddingProgressData) => void): () => void
}

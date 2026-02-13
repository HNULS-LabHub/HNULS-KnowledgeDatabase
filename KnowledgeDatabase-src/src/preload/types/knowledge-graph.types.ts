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
  KGBuildTaskStatus
} from '../../Public/ShareTypes/knowledge-graph-ipc.types'

// 重新导出供前端使用
export type {
  KGSubmitTaskParams,
  KGTaskStatus,
  KGTaskConfig,
  KGCreateSchemaParams,
  KGBuildTaskStatus
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
}

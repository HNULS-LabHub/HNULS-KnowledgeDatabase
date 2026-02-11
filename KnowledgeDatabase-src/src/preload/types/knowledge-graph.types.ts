/**
 * @file 知识图谱类型定义
 * @description 定义知识图谱构建相关的 Preload API 类型
 */

// 复用 ShareTypes 中已有的类型
import type {
  KGSubmitTaskParams,
  KGTaskStatus,
  KGTaskConfig
} from '../../Public/ShareTypes/knowledge-graph-ipc.types'

// 重新导出供前端使用
export type { KGSubmitTaskParams, KGTaskStatus, KGTaskConfig }

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
}

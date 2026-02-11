/**
 * 知识图谱构建状态类型
 */

export type KgBuildStatus = 'idle' | 'pending' | 'running' | 'completed' | 'failed'

export interface KgBuildState {
  /** 文件标识 */
  fileKey: string
  /** 后端任务 ID（kg_task:xxx） */
  taskId?: string
  /** 使用的知识图谱配置ID */
  kgConfigId: string
  /** 构建状态 */
  status: KgBuildStatus
  /** 总 chunk 数 */
  chunksTotal: number
  /** 已完成 chunk 数 */
  chunksCompleted: number
  /** 失败 chunk 数 */
  chunksFailed: number
  /** 错误信息 */
  error?: string
}

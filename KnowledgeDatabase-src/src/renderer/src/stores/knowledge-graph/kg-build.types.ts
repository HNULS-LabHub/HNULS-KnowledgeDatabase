/**
 * 知识图谱构建状态类型
 */

export type KgBuildStatus = 'idle' | 'running' | 'completed' | 'failed'

export interface KgBuildState {
  /** 文件标识 */
  fileKey: string
  /** 使用的知识图谱配置ID */
  kgConfigId: string
  /** 构建状态 */
  status: KgBuildStatus
  /** 错误信息 */
  error?: string
}

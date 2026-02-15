/**
 * @file 知识图谱可视化 - 本地类型定义
 */

/** 图谱实体（精简版，不含溯源字段） */
export interface GraphEntity {
  id: string
  name: string
  type: string
  description: string
}

/** 图谱关系 */
export interface GraphRelation {
  id: string
  source: string
  target: string
  keywords: string
  description: string
  weight: number
}

/** 加载进度 */
export interface LoadingProgress {
  entitiesLoaded: number
  entitiesTotal: number
  relationsLoaded: number
  relationsTotal: number
}

/** 图谱数据加载状态 */
export type GraphLoadState = 'idle' | 'loading' | 'ready' | 'error'

/** 图谱选择器选项 */
export interface GraphOption {
  kbId: number
  kbName: string
  configId: string
  configName: string
  graphTableBase: string
  databaseName: string
}

/** 选中节点的详情 */
export interface NodeDetail {
  id: string
  name: string
  type: string
  description: string
  degree: number
  neighbors: string[]
}

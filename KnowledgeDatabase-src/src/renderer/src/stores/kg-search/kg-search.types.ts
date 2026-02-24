/**
 * 知识图谱检索 Store 临时类型定义
 * TODO: 后端业务完成后迁移到 @preload/types (SharedTypes)
 */

/** 检索模式 */
export type KGSearchMode = 'keyword' | 'entity' | 'path'

export interface KGSearchModeOption {
  value: KGSearchMode
  label: string
  description: string
  icon: string // SVG path
}

/** 图谱节点 */
export interface KGNode {
  id: string
  label: string
  type: string // 实体类型，如 'concept' | 'document' | 'person'
  properties: Record<string, unknown>
}

/** 图谱关系 */
export interface KGEdge {
  id: string
  from: string
  to: string
  relation: string
  weight?: number
  properties: Record<string, unknown>
}

/** 单条检索结果 */
export interface KGSearchHit {
  /** 中心节点 */
  node: KGNode
  /** 关联边 */
  edges: KGEdge[]
  /** 关联的邻居节点 */
  neighbors: KGNode[]
  /** 匹配得分 */
  score: number
  /** 匹配高亮片段 */
  highlight?: string
}

/** 检索结果汇总 */
export interface KGSearchResult {
  hits: KGSearchHit[]
  totalCount: number
  elapsedMs: number
  mode: KGSearchMode
}

/** Store 状态 */
export interface KGSearchState {
  query: string
  mode: KGSearchMode
  isSearching: boolean
  result: KGSearchResult | null
}

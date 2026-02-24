/**
 * 知识图谱检索 Store 类型定义
 * 复用 @preload/types 中的后端契约类型，仅补充 UI 层需要的类型
 */

import type {
  KGRetrievalMode,
  KGRetrievalParams,
  KGRetrievalResult,
  KGRetrievalEntity,
  KGRetrievalRelation,
  KGRetrievalChunk,
  KGRetrievalMeta
} from '@preload/types'

// 重新导出供 view 层使用
export type {
  KGRetrievalMode,
  KGRetrievalParams,
  KGRetrievalResult,
  KGRetrievalEntity,
  KGRetrievalRelation,
  KGRetrievalChunk,
  KGRetrievalMeta
}

/** 检索模式选项（UI 下拉用） */
export interface KGSearchModeOption {
  value: KGRetrievalMode
  label: string
  description: string
  icon: string // SVG path
}

/** 结果展示 Tab */
export type KGResultTab = 'entities' | 'relations' | 'chunks'

/** 向量搜索参数（UI 可调） */
export interface KGVectorSearchUI {
  entityTopK: number
  relationTopK: number
  chunkTopK: number
}

/** 图遍历参数（UI 可调） */
export interface KGGraphTraversalUI {
  maxDepth: number
  maxNeighbors: number
}

/**
 * RAG Store 私有类型定义
 */

export interface RagStep {
  id: number
  text: string
  iconPath: string
  colorClass: 'blue' | 'purple' | 'amber' | 'emerald'
  status: 'pending' | 'loading' | 'completed' | 'error'
}

/** 向量表配置项 */
export interface EmbeddingTableConfig {
  /** 是否启用该向量表 */
  enabled: boolean
  /** TopK 召回数量 */
  k: number
}

/** localStorage 持久化的配置 */
export interface RagConfig {
  rerankEnabled: boolean
  rerankModelId: string | null
  llmModelId: string | null
  llmDrivenEnabled: boolean
  selectedKnowledgeBaseId: number | null
  /** 向量表配置：tableName -> { enabled, k } */
  embeddingTableConfigs: Record<string, EmbeddingTableConfig>
}

export interface RerankModel {
  id: string
  name: string
  provider: string
}

export interface LlmModel {
  id: string
  name: string
  provider: string
}

/** 向量召回命中（来自后端 IPC） */
export interface VectorRecallHit {
  id: string
  content: string
  chunk_index?: number
  file_key?: string
  file_name?: string
  distance?: number
  /** 来源向量表名 */
  tableName: string
  /** 表对应的嵌入配置名称 */
  configName?: string
  /** 表向量维度 */
  dimensions?: number
}

/** 执行检索需要的配置参数 */
export interface RagSearchConfig {
  knowledgeBaseId: number
  /** 向量表配置：tableName -> { enabled, k } */
  embeddingTableConfigs: Record<string, EmbeddingTableConfig>
  /** HNSW ef 参数，默认 100 */
  ef?: number
}

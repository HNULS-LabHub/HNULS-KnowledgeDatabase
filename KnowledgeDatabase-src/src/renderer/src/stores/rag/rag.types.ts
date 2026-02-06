/**
 * RAG Store 私有类型定义
 */

export interface RagStep {
  id: number
  text: string
  iconPath: string
  colorClass: 'blue' | 'purple' | 'amber' | 'emerald'
}

/** localStorage 持久化的配置 */
export interface RagConfig {
  rerankModelId: string | null
  llmModelId: string | null
  llmDrivenEnabled: boolean
  selectedKnowledgeBaseId: number | null
  selectedEmbeddingTables: string[] // tableName 列表
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

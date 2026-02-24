/**
 * @file KG 检索服务类型定义
 * @description 知识图谱检索管线所有内部类型（服务间传递用）
 */

// ============================================================================
// Embedding 调用配置
// ============================================================================

export interface EmbeddingCallConfig {
  baseUrl: string
  apiKey: string
  model: string
  dimensions: number
  headers?: Record<string, string>
}

// ============================================================================
// Rerank 调用配置
// ============================================================================

export interface RerankCallConfig {
  baseUrl: string
  apiKey: string
  model: string
  topN: number
  headers?: Record<string, string>
}

// ============================================================================
// 关键词提取
// ============================================================================

export interface ExtractedKeywords {
  highLevel: string[]
  lowLevel: string[]
}

// ============================================================================
// 向量搜索命中
// ============================================================================

export interface EntitySearchHit {
  id: string
  entity_name: string
  entity_type: string
  description: string
  distance: number
}

export interface RelationSearchHit {
  id: string
  source_name: string
  target_name: string
  keywords: string
  description: string
  weight: number
  distance: number
}

export interface ChunkSearchHit {
  id: string
  content: string
  chunk_index?: number
  file_key?: string
  file_name?: string
  distance: number
}

// ============================================================================
// 图遍历扩展结果
// ============================================================================

export interface ExpandedEntity {
  id: string
  entity_name: string
  entity_type: string
  description: string
}

export interface ExpandedRelation {
  id: string
  source_name: string
  target_name: string
  keywords: string
  description: string
  weight: number
}

export interface GraphExpansionResult {
  /** 扩展到的实体（含描述） */
  entities: ExpandedEntity[]
  /** 扩展到的关系（含描述） */
  relations: ExpandedRelation[]
  /** 收集到的所有源 chunk ID（去重） */
  chunkIds: Set<string>
}

// ============================================================================
// Chunk 收集
// ============================================================================

export interface RawChunk {
  id: string
  content: string
  chunk_index?: number
  file_key?: string
  file_name?: string
}

export interface ScoredChunk {
  id: string
  content: string
  file_key: string
  file_name?: string
  chunk_index?: number
  score: number
  source: 'entity_expansion' | 'relation_expansion' | 'direct_vector'
}

// ============================================================================
// Rerank 结果
// ============================================================================

export interface RerankResult {
  /** 原始文档在 documents 数组中的索引 */
  index: number
  /** 相关性分数（越高越相关） */
  relevance_score: number
}

export interface RerankStrategy {
  /** 构建请求 URL */
  buildUrl(baseURL: string): string
  /** 构建请求体 */
  buildRequestBody(
    query: string,
    documents: string[],
    topN: number,
    model: string
  ): Record<string, unknown>
  /** 从响应中提取重排结果 */
  extractResults(data: unknown): RerankResult[]
}

// ============================================================================
// Token 预算配置
// ============================================================================

export interface TokenBudgetConfig {
  maxEntityDescTokens: number
  maxRelationDescTokens: number
  maxChunkTokens: number
  maxTotalTokens: number
}

// ============================================================================
// 向量搜索参数配置
// ============================================================================

export interface VectorSearchConfig {
  entityTopK: number
  relationTopK: number
  chunkTopK: number
  ef: number
}

// ============================================================================
// 图遍历参数配置
// ============================================================================

export interface GraphTraversalConfig {
  maxDepth: number
  maxNeighbors: number
}

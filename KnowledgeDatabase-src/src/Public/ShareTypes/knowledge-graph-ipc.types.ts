/**
 * @file 知识图谱 IPC 消息协议
 * @description 定义 Main ↔ Knowledge-graph (Utility Process) 之间的消息类型
 */

// ============================================================================
// DB 连接配置
// ============================================================================

export interface KGDBConfig {
  serverUrl: string
  username: string
  password: string
  namespace: string
  database: string // 固定 'system'
}
// ============================================================================
// LLM Provider Config（给 Utility 进程使用）
// ============================================================================

export interface KGModelProviderConfig {
  id: string
  protocol: 'openai'
  baseUrl: string
  apiKey: string
  enabled: boolean
}

// ============================================================================
// 任务配置（FLEXIBLE，未来可扩展）
// ============================================================================

export interface KGTaskConfig {
  /** LLM 模型标识 */
  model: string
  /** LLM Provider ID */
  providerId?: string
  /** LLM Model ID */
  modelId?: string
  /** 需要提取的实体类型列表 */
  entityTypes?: string[]
  /** 输出语言 */
  outputLanguage?: string
  /** LLM 并发（批次内并行） */
  llmConcurrency?: number
  /** 关联的嵌入配置 ID */
  embeddingConfigId?: string
  /** 嵌入版本时间（用于重新嵌入判定） */
  embeddingUpdatedAt?: string
  /** 未来扩展字段 */
  [key: string]: unknown
}

// ============================================================================
// 任务提交参数
// ============================================================================

export interface KGSubmitTaskParams {
  /** 文件标识 */
  fileKey: string
  /** 来源知识库 namespace */
  sourceNamespace: string
  /** 来源知识库 database */
  sourceDatabase: string
  /** 来源嵌入表名（存放 chunks 的表） */
  sourceTable: string
  /** 任务配置 */
  config: KGTaskConfig
  /** 目标知识库 namespace（第二阶段 graph build） */
  targetNamespace?: string
  /** 目标知识库 database */
  targetDatabase?: string
  /** 图谱表基名，如 'kg_emb_cfg_xxx_3072' */
  targetTableBase?: string
}

// ============================================================================
// 任务状态
// ============================================================================

export type KGTaskStatusEnum = 'pending' | 'progressing' | 'paused' | 'completed' | 'failed'
export type KGChunkStatusEnum = 'pending' | 'progressing' | 'paused' | 'completed' | 'failed'

export interface KGTaskStatus {
  taskId: string
  fileKey: string
  status: KGTaskStatusEnum
  chunksTotal: number
  chunksCompleted: number
  chunksFailed: number
}

// ============================================================================
// 图谱数据流式查询参数
// ============================================================================

export interface KGGraphQueryParams {
  /** 目标 namespace */
  targetNamespace: string
  /** 目标 database */
  targetDatabase: string
  /** 图谱表基名，如 'kg_emb_cfg_xxx_3072' */
  graphTableBase: string
  /** 每批次返回的记录数，默认 100 */
  batchSize?: number
}

// ============================================================================
// 图谱数据类型（精简版，用于可视化）
// ============================================================================

export interface KGGraphEntity {
  id: string
  name: string
  type: string
  description: string
}

export interface KGGraphRelation {
  id: string
  source: string
  target: string
  keywords: string
  description: string
  weight: number
}

export interface KGGraphDataProgress {
  entitiesLoaded: number
  entitiesTotal: number
  relationsLoaded: number
  relationsTotal: number
}

// ============================================================================
// 嵌入相关参数与状态
// ============================================================================

/** 触发嵌入任务的参数（Main → KG） */
export interface KGTriggerEmbeddingParams {
  /** 目标 namespace */
  targetNamespace: string
  /** 目标 database */
  targetDatabase: string
  /** 图谱表基名，如 'kg_emb_cfg_xxx_3072' */
  graphTableBase: string
  /** 嵌入 API 基础 URL */
  baseUrl: string
  /** 嵌入 API 密钥 */
  apiKey: string
  /** 嵌入模型标识 */
  model: string
  /** 向量维度 */
  dimensions: number
  /** 每批次处理的实体数 */
  batchSize: number
  /** 描述截断的最大 token 数 */
  maxTokens: number
}

/** 嵌入进度数据（KG → Main） */
export interface KGEmbeddingProgressData {
  /** 调度器状态 */
  state: 'idle' | 'active' | 'error'
  /** 已完成嵌入总数（实体 + 关系） */
  completed: number
  /** 待嵌入总数（实体 + 关系） */
  pending: number
  /** 总数（实体 + 关系） */
  total: number
  /** HNSW 索引是否全部就绪（实体 + 关系） */
  hnswIndexReady: boolean
  /** 已完成嵌入的实体数 */
  entityCompleted: number
  /** 待嵌入的实体数 */
  entityPending: number
  /** 实体总数 */
  entityTotal: number
  /** 已完成嵌入的关系数 */
  relationCompleted: number
  /** 待嵌入的关系数 */
  relationPending: number
  /** 关系总数 */
  relationTotal: number
  /** 实体 HNSW 索引是否就绪 */
  entityHnswIndexReady: boolean
  /** 关系 HNSW 索引是否就绪 */
  relationHnswIndexReady: boolean
  /** 最近一次错误信息 */
  lastError: string | null
  /** 最近一次批次处理摘要 */
  lastBatchInfo: {
    target: 'entity' | 'relation'
    successCount: number
    failCount: number
    durationMs: number
    remaining: number
  } | null
}

/** 嵌入状态查询响应数据（与 KGEmbeddingProgressData 结构相同） */
export type KGEmbeddingStatusData = KGEmbeddingProgressData

/** 嵌入恢复项（自检发现的待恢复目标） */
export interface KGEmbeddingRecoveryItem {
  targetNamespace: string
  targetDatabase: string
  graphTableBase: string
  embeddingConfigId: string
  pendingCount: number
}

// ============================================================================
// Main → KG 消息
// ============================================================================

export type MainToKGMessage =
  | { type: 'kg:init'; dbConfig: KGDBConfig }
  | { type: 'kg:submit-task'; requestId: string; data: KGSubmitTaskParams }
  | { type: 'kg:update-concurrency'; maxConcurrency: number }
  | { type: 'kg:query-status'; requestId: string }
  | { type: 'kg:concurrency-response'; value: number }
  | { type: 'kg:update-model-providers'; providers: KGModelProviderConfig[] }
  | { type: 'kg:create-graph-schema'; requestId: string; data: KGCreateSchemaParams }
  | { type: 'kg:query-build-status'; requestId: string }
  // 图谱数据流式查询
  | { type: 'kg:query-graph-data'; requestId: string; data: KGGraphQueryParams }
  | { type: 'kg:cancel-graph-query'; sessionId: string }
  // 嵌入相关
  | { type: 'kg:trigger-embedding'; data: KGTriggerEmbeddingParams }
  | { type: 'kg:query-embedding-status'; requestId: string }
  // KG 检索
  | { type: 'kg:retrieval-search'; requestId: string; data: KGRetrievalParams }

// ============================================================================
// KG → Main 消息
// ============================================================================

export type KGToMainMessage =
  | { type: 'kg:ready' }
  | { type: 'kg:init-result'; success: boolean; error?: string }
  | { type: 'kg:task-created'; requestId: string; taskId: string; chunksTotal: number }
  | { type: 'kg:task-error'; requestId: string; error: string }
  | {
      type: 'kg:task-progress'
      taskId: string
      completed: number
      failed: number
      total: number
    }
  | { type: 'kg:task-completed'; taskId: string }
  | { type: 'kg:task-failed'; taskId: string; error: string }
  | { type: 'kg:status'; requestId: string; tasks: KGTaskStatus[] }
  | { type: 'kg:log'; level: 'debug' | 'info' | 'warn' | 'error'; message: string; meta?: any }
  | { type: 'kg:request-concurrency' }
  | { type: 'kg:schema-created'; requestId: string; tables: string[] }
  | { type: 'kg:schema-error'; requestId: string; error: string }
  | {
      type: 'kg:build-progress'
      taskId: string
      completed: number
      failed: number
      total: number
      entitiesTotal: number
      relationsTotal: number
    }
  | {
      type: 'kg:build-completed'
      taskId: string
      targetNamespace?: string
      targetDatabase?: string
      graphTableBase?: string
      embeddingConfigId?: string
    }
  | { type: 'kg:build-failed'; taskId: string; error: string }
  | { type: 'kg:build-status'; requestId: string; tasks: KGBuildTaskStatus[] }
  // 图谱数据流式查询响应
  | { type: 'kg:graph-query-started'; requestId: string; sessionId: string }
  | {
      type: 'kg:graph-data-batch'
      sessionId: string
      entities: KGGraphEntity[]
      relations: KGGraphRelation[]
      progress: KGGraphDataProgress
    }
  | { type: 'kg:graph-data-complete'; sessionId: string }
  | { type: 'kg:graph-data-error'; sessionId: string; error: string }
  | { type: 'kg:graph-data-cancelled'; sessionId: string }
  // 嵌入相关
  | { type: 'kg:embedding-progress'; data: KGEmbeddingProgressData }
  | { type: 'kg:embedding-status'; requestId: string; data: KGEmbeddingStatusData }
  | { type: 'kg:embedding-recovery-needed'; items: KGEmbeddingRecoveryItem[] }
  // KG 检索
  | { type: 'kg:retrieval-result'; requestId: string; data: KGRetrievalResult }
  | { type: 'kg:retrieval-error'; requestId: string; error: string }

// ============================================================================
// KG 检索参数与结果
// ============================================================================

/** 检索模式 */
export type KGRetrievalMode = 'local' | 'global' | 'hybrid' | 'naive'

/** 检索请求参数（Main → KG） */
export interface KGRetrievalParams {
  /** 用户查询文本 */
  query: string
  /** 检索模式 */
  mode: KGRetrievalMode

  // ========== 目标库定位 ==========
  /** 目标 namespace */
  targetNamespace: string
  /** 目标 database */
  targetDatabase: string
  /** 图谱表基名，如 'kg_emb_cfg_xxx_3072' */
  graphTableBase: string

  // ========== Embedding 配置（查询向量化） ==========
  embeddingConfig: {
    providerId: string
    modelId: string
    baseUrl: string
    apiKey: string
    dimensions: number
    headers?: Record<string, string>
  }

  // ========== 关键词提取配置 ==========
  keywordExtraction?: {
    /** false = 跳过 LLM，使用手动关键词 */
    useLLM: boolean
    /** LLM 提供者（useLLM=true 时必填） */
    llmProviderId?: string
    llmModelId?: string
    /** 手动关键词（useLLM=false 时使用） */
    manualHighLevelKeywords?: string[]
    manualLowLevelKeywords?: string[]
  }

  // ========== 向量搜索参数 ==========
  vectorSearch?: {
    entityTopK?: number
    relationTopK?: number
    chunkTopK?: number
    ef?: number
  }

  // ========== 图遍历参数 ==========
  graphTraversal?: {
    maxDepth?: number
    maxNeighbors?: number
  }

  // ========== Chunk 向量表（naive 模式必填） ==========
  chunkTableName?: string

  // ========== 重排配置 ==========
  rerank?: {
    enabled: boolean
    providerId?: string
    modelId?: string
    baseUrl?: string
    apiKey?: string
    topN?: number
    headers?: Record<string, string>
  }

  // ========== Token 预算 ==========
  tokenBudget?: {
    maxEntityDescTokens?: number
    maxRelationDescTokens?: number
    maxChunkTokens?: number
    maxTotalTokens?: number
  }
}

/** 检索结果中的实体 */
export interface KGRetrievalEntity {
  id: string
  name: string
  entity_type: string
  description: string
  score: number
}

/** 检索结果中的关系 */
export interface KGRetrievalRelation {
  id: string
  source_name: string
  target_name: string
  description: string
  keywords: string
  score: number
}

/** 检索结果中的 Chunk */
export interface KGRetrievalChunk {
  id: string
  content: string
  file_key: string
  file_name?: string
  chunk_index?: number
  score: number
  source: 'entity_expansion' | 'relation_expansion' | 'direct_vector'
}

/** 检索元数据 */
export interface KGRetrievalMeta {
  mode: KGRetrievalMode
  extractedKeywords: {
    highLevel: string[]
    lowLevel: string[]
  }
  entityCount: number
  relationCount: number
  chunkCount: number
  durationMs: number
  rerankApplied: boolean
}

/** 检索结果（KG → Main） */
export interface KGRetrievalResult {
  entities: KGRetrievalEntity[]
  relations: KGRetrievalRelation[]
  chunks: KGRetrievalChunk[]
  meta: KGRetrievalMeta
}

// ============================================================================
// Graph Schema 创建参数
// ============================================================================

export interface KGCreateSchemaParams {
  targetNamespace: string
  targetDatabase: string
  graphTableBase: string
}

// ============================================================================
// Graph Build 任务状态
// ============================================================================

export interface KGBuildTaskStatus {
  taskId: string
  sourceTaskId: string
  fileKey: string
  status: string
  chunksTotal: number
  chunksCompleted: number
  chunksFailed: number
  entitiesUpserted: number
  relationsUpserted: number
}

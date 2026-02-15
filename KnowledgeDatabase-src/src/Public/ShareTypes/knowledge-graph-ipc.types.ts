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
  | { type: 'kg:build-completed'; taskId: string }
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

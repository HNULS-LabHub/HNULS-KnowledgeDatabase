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

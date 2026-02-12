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
// 任务配置（FLEXIBLE，未来可扩展）
// ============================================================================

export interface KGTaskConfig {
  /** LLM 模型标识 */
  model: string
  /** 需要提取的实体类型列表 */
  entityTypes?: string[]
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

/**
 * Agent 运行状态与事件协议
 * 通用设计，适配不同 Agent 实现
 */

/** Agent 运行状态 */
export type AgentStatus = 'idle' | 'running' | 'completed' | 'error' | 'cancelled'

/** Agent 运行实例 */
export interface AgentRun {
  runId: string
  status: AgentStatus
  startedAt: number
  endedAt?: number
  /** 使用的 LLM 模型 ID */
  modelId: string
  /** 知识库 ID */
  kbId: number
  /** 用户问题 */
  question: string
  /** 最终答案 */
  answer: string
  /** 引用文档 */
  citations: AgentCitation[]
  /** 错误信息 */
  error?: string
}

/** 引用文档 */
export interface AgentCitation {
  docId: string
  /** 片段定位（可选） */
  spans?: Array<{ start: number; end: number }>
  /** 简要对齐说明（可选） */
  rationale?: string
}

/** 检索文档 */
export interface AgentDoc {
  id: string
  title?: string
  content: string
  file_key?: string
  file_name?: string
  table?: string
  rerank_score?: number
  distance?: number
}

/** Agent 事件协议（判别联合） */
export type AgentEvent =
  | AgentRunStartedEvent
  | AgentRunCompletedEvent
  | AgentNodeStartedEvent
  | AgentNodeCompletedEvent
  | AgentToolCalledEvent
  | AgentToolResultEvent
  | AgentRetrievalResultsEvent
  | AgentTokenEvent
  | AgentStateUpdateEvent
  | AgentErrorEvent

/** 运行开始 */
export interface AgentRunStartedEvent {
  type: 'run_started'
  runId: string
  at: number
}

/** 运行完成 */
export interface AgentRunCompletedEvent {
  type: 'run_completed'
  runId: string
  at: number
  answer?: string
  citations?: AgentCitation[]
}

/** 节点开始 */
export interface AgentNodeStartedEvent {
  type: 'node_started'
  runId: string
  node: string
  at: number
  data?: any
}

/** 节点完成 */
export interface AgentNodeCompletedEvent {
  type: 'node_completed'
  runId: string
  node: string
  at: number
  data?: any
}

/** 工具调用 */
export interface AgentToolCalledEvent {
  type: 'tool_called'
  runId: string
  tool: string
  at: number
  input?: any
}

/** 工具结果 */
export interface AgentToolResultEvent {
  type: 'tool_result'
  runId: string
  tool: string
  at: number
  output?: any
}

/** 检索结果 */
export interface AgentRetrievalResultsEvent {
  type: 'retrieval_results'
  runId: string
  at: number
  docs: AgentDoc[]
}

/** 流式 token */
export interface AgentTokenEvent {
  type: 'token'
  runId: string
  at: number
  text: string
}

/** 状态更新 */
export interface AgentStateUpdateEvent {
  type: 'state_update'
  runId: string
  at: number
  patch: any
}

/** 错误 */
export interface AgentErrorEvent {
  type: 'error'
  runId: string
  at: number
  message: string
  node?: string
  stack?: string
}

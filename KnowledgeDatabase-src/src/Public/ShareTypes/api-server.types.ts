/**
 * @file API Server 共享类型定义
 * @description Express API 服务的 IPC 协议和 REST API 契约
 */

// ============================================================================
// 配置类型
// ============================================================================

/**
 * API 服务器配置
 */
export interface ApiServerConfig {
  /** 监听端口 */
  port: number
  /** 监听地址 */
  host: string
}

/**
 * 数据库连接配置
 */
export interface ApiServerDBConfig {
  /** SurrealDB WebSocket URL */
  serverUrl: string
  /** 用户名 */
  username: string
  /** 密码 */
  password: string
  /** 命名空间 */
  namespace: string
}

/**
 * 默认配置
 */
export const DEFAULT_API_SERVER_CONFIG: ApiServerConfig = {
  port: 3721,
  host: '0.0.0.0'
}

// ============================================================================
// IPC 消息类型 (Main ↔ ApiServer)
// ============================================================================

/**
 * Main → ApiServer 消息
 */
export type MainToApiServerMessage =
  | {
      type: 'server:start'
      config: ApiServerConfig
      dbConfig: ApiServerDBConfig
      metaFilePath: string
    }
  | { type: 'server:stop' }
  | { type: 'server:query-status'; requestId: string }

/**
 * ApiServer → Main 消息
 */
export type ApiServerToMainMessage =
  | { type: 'server:ready' }
  | { type: 'server:started'; port: number; host: string }
  | { type: 'server:stopped' }
  | { type: 'server:error'; message: string; details?: string }
  | { type: 'server:status'; requestId: string; status: ApiServerStatus }

/**
 * API 服务器状态
 */
export interface ApiServerStatus {
  /** 是否运行中 */
  running: boolean
  /** 监听端口 */
  port: number | null
  /** 监听地址 */
  host: string | null
  /** 运行时间 (ms) */
  uptime: number
  /** 请求计数 */
  requestCount: number
}

// ============================================================================
// REST API 响应类型
// ============================================================================

/**
 * 通用成功响应
 */
export interface ApiSuccessResponse<T> {
  success: true
  data: T
}

/**
 * 通用错误响应
 */
export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: any
  }
}

/**
 * API 响应类型
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

// ============================================================================
// 知识库相关类型
// ============================================================================

/**
 * 知识库信息 (列表项)
 */
export interface KnowledgeBaseInfo {
  /** 知识库 ID */
  id: number
  /** 名称 */
  name: string
  /** 描述 */
  description: string
  /** 文档数量 */
  docCount: number
  /** 分片数量 */
  chunkCount: number
  /** 创建时间 */
  createdAt: string
  /** 最后更新时间 */
  lastUpdated: string
  /** 主题颜色 */
  color: string
  /** 图标 */
  icon: string
}

/**
 * 知识库详情
 */
export interface KnowledgeBaseDetail extends KnowledgeBaseInfo {
  /** 数据库名称 */
  databaseName: string
  /** 文档目录路径 */
  documentPath?: string
}

/**
 * 文档信息
 */
export interface DocumentInfo {
  /** 记录 ID */
  id: string
  /** 文件标识 (相对路径) */
  fileKey: string
  /** 文件名 */
  fileName: string
  /** 文件类型 */
  fileType: string
  /** 更新时间 */
  updatedAt: string
  /** 该文档的所有嵌入配置列表 */
  embeddings: DocumentEmbeddingItem[]
}

/**
 * 文档的单个嵌入配置信息
 */
export interface DocumentEmbeddingItem {
  /** 嵌入配置 ID */
  embeddingConfigId: string
  /** 向量维度 */
  dimensions: number
  /** 状态 */
  status: 'pending' | 'running' | 'completed' | 'failed'
  /** 分片数量 */
  chunkCount: number
  /** 更新时间 */
  updatedAt: string
}

/**
 * 文档嵌入信息 (支持多配置)
 */
export interface DocumentEmbeddingInfo {
  /** 文件标识 */
  fileKey: string
  /** 嵌入配置 ID */
  embeddingConfigId: string
  /** 向量维度 */
  dimensions: number
  /** 状态 */
  status: 'pending' | 'running' | 'completed' | 'failed'
  /** 分片数量 */
  chunkCount: number
  /** 更新时间 */
  updatedAt: string
}

/**
 * 分页信息
 */
export interface PaginationInfo {
  /** 总数 */
  total: number
  /** 当前页 */
  page: number
  /** 每页数量 */
  pageSize: number
  /** 总页数 */
  totalPages: number
}

// ============================================================================
// API 响应类型别名
// ============================================================================

/** 服务状态响应 */
export type StatusResponse = ApiResponse<{
  status: 'ok'
  version: string
  uptime: number
}>

/** 知识库列表响应 */
export type ListKnowledgeBasesResponse = ApiResponse<KnowledgeBaseInfo[]>

/** 知识库详情响应 */
export type GetKnowledgeBaseResponse = ApiResponse<KnowledgeBaseDetail>

/** 文档列表响应 */
export type ListDocumentsResponse = ApiResponse<{
  documents: DocumentInfo[]
  pagination: PaginationInfo
}>

/** 文档嵌入列表响应 */
export type ListDocumentEmbeddingsResponse = ApiResponse<DocumentEmbeddingInfo[]>

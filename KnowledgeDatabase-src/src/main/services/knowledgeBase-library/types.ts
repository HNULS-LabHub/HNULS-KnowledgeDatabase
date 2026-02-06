/**
 * 知识库元数据接口
 */
export interface KnowledgeBaseMeta {
  /** 知识库唯一标识符 */
  id: number
  /** 知识库名称 */
  name: string
  /** 知识库描述 */
  description: string
  /** 文档数量 */
  docCount: number
  /** 分片数量（原向量数） */
  chunkCount: number
  /** 最后更新时间 */
  lastUpdated: string
  /** 创建时间 */
  createdAt: string
  /** 主题颜色（Hex） */
  color: string
  /** 图标（SVG 字符串） */
  icon: string
  /** 文档目录路径（相对于 userData/data/documents/） */
  documentPath?: string
  /** SurrealDB 数据库名称 */
  databaseName: string
}

/**
 * 知识库元数据文件结构
 */
export interface KnowledgeLibraryMeta {
  /** 元数据文件版本 */
  version: string
  /** 知识库列表 */
  knowledgeBases: KnowledgeBaseMeta[]
}

/**
 * 创建知识库时的数据（不需要 id、createdAt、lastUpdated）
 */
export interface CreateKnowledgeBaseData {
  name: string
  description: string
  color: string
  icon: string
}

/**
 * 更新知识库时的数据（部分字段可选）
 */
export type UpdateKnowledgeBaseData = Partial<Omit<KnowledgeBaseMeta, 'id' | 'createdAt'>>

/**
 * 清理孤立目录的结果
 */
export interface CleanupResult {
  /** 扫描的目录数量 */
  scanned: number
  /** 删除的孤立目录 ID 列表 */
  removed: string[]
  /** 删除失败的目录 */
  failed: Array<{
    id: string
    error: string
  }>
}

// ============================================================================
// 嵌入配置类型（用于多模型向量分表）
// ============================================================================

/**
 * 嵌入配置候选项（provider + model 组合）
 */
export interface EmbeddingCandidate {
  providerId: string
  modelId: string
}

/**
 * 单个嵌入配置项
 * 来自 KnowledgeConfig.json 的 embedding.configs[]
 */
export interface EmbeddingConfigItem {
  /** 配置唯一标识，如 "cfg_1769446275961" */
  id: string
  /** 配置名称，如 "Text Embedding 3 Large" */
  name: string
  /** 嵌入向量维度，如 3072 */
  dimensions: number
  /** 可用的 provider + model 候选列表 */
  candidates: EmbeddingCandidate[]
}

/**
 * 全局嵌入配置（包含多个配置项）
 */
export interface EmbeddingGlobalConfig {
  configs: EmbeddingConfigItem[]
}

/**
 * 嵌入向量表信息（用于 RAG 检索）
 */
export interface EmbeddingTableInfo {
  /** 表名（如 emb_cfg_xxx_3072_chunks） */
  tableName: string
  /** 嵌入配置 ID */
  configId: string
  /** 嵌入配置名称（从 kb_document_embedding 表获取） */
  configName: string | null
  /** 向量维度 */
  dimensions: number
  /** chunk 数量 */
  chunkCount: number
}

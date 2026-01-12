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
  /** 文档目录路径（相对于 userData/data/document/） */
  documentPath?: string
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
export type UpdateKnowledgeBaseData = Partial<
  Omit<KnowledgeBaseMeta, 'id' | 'createdAt'>
>

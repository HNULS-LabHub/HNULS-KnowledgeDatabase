/**
 * 知识库元数据接口（前端使用）
 */
export interface KnowledgeBase {
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
}

/**
 * 创建知识库时的数据
 */
export interface CreateKnowledgeBaseData {
  name: string
  description: string
  color: string
  icon: string
}

/**
 * 更新知识库时的数据
 */
export type UpdateKnowledgeBaseData = Partial<Omit<KnowledgeBase, 'id' | 'createdAt'>>

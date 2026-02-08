/**
 * 知识库业务域类型定义
 */
/**
 * 注意：preload/types 不能依赖 main 进程实现路径（tsconfig 也不会包含 main 目录）。
 * 这些类型需要在 preload 侧自洽定义，作为跨进程契约。
 */

export interface KnowledgeBaseMeta {
  id: number
  name: string
  description: string
  docCount: number
  chunkCount: number
  lastUpdated: string
  createdAt: string
  color: string
  icon: string
  documentPath?: string
  databaseName: string
}

export interface CreateKnowledgeBaseData {
  name: string
  description: string
  color: string
  icon: string
}

export type UpdateKnowledgeBaseData = Partial<Omit<KnowledgeBaseMeta, 'id' | 'createdAt'>>

export interface EmbeddingTableInfo {
  tableName: string
  configId: string
  configName: string | null
  dimensions: number
  chunkCount: number
}

/**
 * 知识库 API 接口定义
 */
export interface KnowledgeLibraryAPI {
  getAll(): Promise<KnowledgeBaseMeta[]>
  getById(id: number): Promise<KnowledgeBaseMeta>
  create(data: CreateKnowledgeBaseData): Promise<KnowledgeBaseMeta>
  update(id: number, data: UpdateKnowledgeBaseData): Promise<KnowledgeBaseMeta>
  delete(id: number): Promise<void>
  listEmbeddingTables(knowledgeBaseId: number): Promise<EmbeddingTableInfo[]>
}

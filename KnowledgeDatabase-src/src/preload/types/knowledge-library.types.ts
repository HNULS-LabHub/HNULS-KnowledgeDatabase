/**
 * 知识库业务域类型定义
 */
import type {
  KnowledgeBaseMeta,
  CreateKnowledgeBaseData,
  UpdateKnowledgeBaseData,
  EmbeddingTableInfo
} from '../../../main/services/knowledgeBase-library/types'

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

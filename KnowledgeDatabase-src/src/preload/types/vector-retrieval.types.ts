/**
 * @file 向量召回服务类型定义（Preload 层）
 * @description 定义向量召回相关的请求参数、命中结果和 API 接口
 */

/**
 * 向量召回搜索请求参数
 */
export interface VectorRetrievalSearchParams {
  /** 知识库 ID */
  knowledgeBaseId: number
  /** 向量表名（如 emb_cfg_xxx_3072_chunks） */
  tableName: string
  /** 用户查询文本 */
  queryText: string
  /** TopK，默认 10 */
  k?: number
  /** HNSW ef 参数，默认 100 */
  ef?: number
}

/**
 * 单条召回命中
 */
export interface VectorRetrievalHit {
  id: string
  content: string
  chunk_index?: number
  file_key?: string
  file_name?: string
  distance?: number
}

/**
 * 向量召回 API 返回结构
 */
export interface VectorRetrievalSearchResult {
  success: boolean
  data?: VectorRetrievalHit[]
  error?: string
}

/**
 * 向量召回 Preload API
 */
export interface VectorRetrievalAPI {
  /**
   * 执行向量召回搜索
   * 自动完成 queryText 嵌入 + 指定向量表 KNN 检索
   */
  search(params: VectorRetrievalSearchParams): Promise<VectorRetrievalSearchResult>
}

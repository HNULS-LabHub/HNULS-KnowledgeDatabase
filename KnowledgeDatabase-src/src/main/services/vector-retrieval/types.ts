/**
 * @file 向量召回服务类型定义
 */

/**
 * 向量召回请求参数（由 IPC 传入）
 */
export interface VectorRetrievalSearchParams {
  /** 知识库 ID */
  knowledgeBaseId: number
  /** 向量表名（如 emb_cfg_xxx_3072_chunks） */
  tableName: string
  /** 用户查询文本 */
  queryText: string

  // ========== [Feature] fileKey/fileKeys 筛选参数（v3 新增） ==========
  /** 仅检索指定 file_key 的分片（单值优先于数组） */
  fileKey?: string
  /** 仅检索指定 file_key 列表的分片 */
  fileKeys?: string[]
  // ========== [/Feature] ==========
  /** TopK */
  k?: number
  /** HNSW ef 参数 */
  ef?: number
  /** 重排模型 ID（可选，传入则执行重排） */
  rerankModelId?: string
  /** 重排 TopN（可选，默认等于 k） */
  rerankTopN?: number
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
  /** 重排分数（仅在启用重排时存在） */
  rerank_score?: number
}

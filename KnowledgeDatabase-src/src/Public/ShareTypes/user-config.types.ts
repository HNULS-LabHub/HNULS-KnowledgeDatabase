/**
 * @file 用户配置共享类型定义
 * @description 跨进程（Main / Preload / Renderer）通用的用户配置契约
 */

export interface MinerUConfig {
  apiKey: string
}

export interface UserEmbeddingConfig {
  concurrency: number
  /** HNSW 索引每批次处理的记录数 */
  hnswBatchSize: number
}

export interface KnowledgeGraphConfig {
  /** 知识图谱构建时分块处理的最高并行数 */
  chunkConcurrency: number
}

export interface UserConfig {
  version: number
  updatedAt: string
  minerU: MinerUConfig
  embedding: UserEmbeddingConfig
  knowledgeGraph: KnowledgeGraphConfig
}

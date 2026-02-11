import type {
  MinerUConfig,
  UserEmbeddingConfig,
  KnowledgeGraphConfig,
  UserConfig
} from '@shared/user-config.types'

export type { MinerUConfig, UserEmbeddingConfig, KnowledgeGraphConfig, UserConfig }

export const DEFAULT_USER_CONFIG: UserConfig = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  minerU: {
    apiKey: ''
  },
  embedding: {
    concurrency: 5,
    hnswBatchSize: 10
  },
  knowledgeGraph: {
    chunkConcurrency: 3
  }
}

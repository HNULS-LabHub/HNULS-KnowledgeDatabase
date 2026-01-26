export interface MinerUConfig {
  apiKey: string
}

export interface EmbeddingConfig {
  concurrency: number
}

export interface UserConfig {
  version: number
  updatedAt: string
  minerU: MinerUConfig
  embedding: EmbeddingConfig
}

export const DEFAULT_USER_CONFIG: UserConfig = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  minerU: {
    apiKey: ''
  },
  embedding: {
    concurrency: 5
  }
}

/**
 * @file 用户配置共享类型定义
 * @description 跨进程（Main / Preload / Renderer）通用的用户配置契约
 */

export interface MinerUConfig {
  apiKey: string
}

export interface UserEmbeddingConfig {
  concurrency: number
}

export interface UserConfig {
  version: number
  updatedAt: string
  minerU: MinerUConfig
  embedding: UserEmbeddingConfig
}

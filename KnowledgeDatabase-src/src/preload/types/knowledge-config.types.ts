/**
 * 知识库配置类型定义
 * 支持全局配置和文档独立配置
 */

import type { APIResponse } from './base.types'

/**
 * 分块配置
 */
export interface ChunkingConfig {
  mode: 'recursive' // 固定值：段落分块模式
  maxChars?: number // undefined = 跟随全局
}

export interface EmbeddingModelCandidate {
  providerId: string
  modelId: string
}

export interface EmbeddingModelConfig {
  id: string
  name: string
  presetName?: string
  candidates: EmbeddingModelCandidate[]
  dimensions?: number
}

/**
 * 嵌入配置
 */
export interface EmbeddingConfig {
  configs: EmbeddingModelConfig[]
  /** 默认嵌入配置ID（用于批量嵌入等场景） */
  defaultConfigId?: string
}

/**
 * 文档配置（可覆盖全局）
 */
export interface DocumentConfig {
  chunking?: ChunkingConfig
  /** 文档独立的嵌入配置ID（可选，不设置则跟随全局默认） */
  embeddingConfigId?: string
}

/**
 * 知识库全局配置
 */
export interface KnowledgeGlobalConfig {
  chunking: Required<ChunkingConfig> // 全局必须有完整配置
  embedding?: EmbeddingConfig // 嵌入配置（可选）
  // 预留其他配置
}

/**
 * 知识库配置文件结构
 */
export interface KnowledgeConfig {
  version: string
  global: KnowledgeGlobalConfig
  documents: Record<string, DocumentConfig> // key = fileKey（文件相对路径）
}

/**
 * 知识库配置 API 接口定义
 */
export interface KnowledgeConfigAPI {
  getConfig(knowledgeBaseId: number): Promise<APIResponse<KnowledgeConfig>>
  updateGlobalConfig(
    knowledgeBaseId: number,
    globalConfig: Partial<KnowledgeGlobalConfig>
  ): Promise<APIResponse<KnowledgeConfig>>
  getDocumentConfig(
    knowledgeBaseId: number,
    fileKey: string
  ): Promise<APIResponse<Required<DocumentConfig>>>
  updateDocumentConfig(
    knowledgeBaseId: number,
    fileKey: string,
    docConfig: DocumentConfig
  ): Promise<APIResponse<KnowledgeConfig>>
  clearDocumentConfig(
    knowledgeBaseId: number,
    fileKey: string
  ): Promise<APIResponse<KnowledgeConfig>>
  validateAndCleanup(knowledgeBaseId: number): Promise<APIResponse<void>>
}

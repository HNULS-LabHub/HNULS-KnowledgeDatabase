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

/**
 * 嵌入配置
 */
export interface EmbeddingConfig {
  providerId?: string // 模型提供商 ID
  modelId?: string // 模型 ID
  dimensions?: number // 嵌入维度（可选，留空则不传递）
}

/**
 * 文档配置（可覆盖全局）
 */
export interface DocumentConfig {
  chunking?: ChunkingConfig
  // 预留其他配置
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


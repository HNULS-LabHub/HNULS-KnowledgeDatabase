/**
 * ֪ʶ���������Ͷ���
 * ֧��ȫ�����ú��ĵ���������
 */

import type { APIResponse } from './base.types'
import type { ChunkingConfig } from '@shared/chunking.types'

export type KnowledgeChunkingConfig = Partial<ChunkingConfig>

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
 * ֪ʶ������Ƕ������
 */
export interface KnowledgeEmbeddingConfig {
  configs: EmbeddingModelConfig[]
  /** Ĭ��Ƕ������ID����������Ƕ��ȳ����� */
  defaultConfigId?: string
}

/**
 * �ĵ����ã��ɸ���ȫ�֣�
 */
export interface DocumentConfig {
  chunking?: KnowledgeChunkingConfig
  /** �ĵ�������Ƕ������ID����ѡ�������������ȫ��Ĭ�ϣ� */
  embeddingConfigId?: string
}

/**
 * ֪ʶ��ȫ������
 */
export interface KnowledgeGlobalConfig {
  chunking: Required<ChunkingConfig> // ȫ�ֱ�������������
  embedding?: KnowledgeEmbeddingConfig // Ƕ�����ã���ѡ��
  // Ԥ����������
}

/**
 * ֪ʶ�������ļ��ṹ
 */
export interface KnowledgeConfig {
  version: string
  global: KnowledgeGlobalConfig
  documents: Record<string, DocumentConfig> // key = fileKey���ļ����·����
}

/**
 * ֪ʶ������ API �ӿڶ���
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

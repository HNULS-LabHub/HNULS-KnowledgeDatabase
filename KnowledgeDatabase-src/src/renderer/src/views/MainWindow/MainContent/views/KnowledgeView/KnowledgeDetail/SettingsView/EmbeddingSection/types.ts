import type { EmbeddingModelCandidate } from '@preload/types'

/**
 * 模型能力标签
 */
export type ModelCapability = 'vision' | 'reasoning' | 'tool' | 'web' | 'free'

/**
 * 模型显示信息（用于 UI 展示）
 */
export interface ModelDisplayInfo {
  id: string
  name: string
  providerId: string
  providerName: string
  group?: string
  capabilities?: ModelCapability[]
}

/**
 * 模型筛选标签
 */
export interface FilterTag {
  id: string
  label: string
  icon?: string
}

/**
 * 嵌入模型配置（本地 UI 扩展）
 */
export interface EmbeddingModelConfig {
  id: string
  name: string
  presetId?: string
  candidates: EmbeddingModelCandidate[]
  dimensions?: number
  isActive?: boolean
}

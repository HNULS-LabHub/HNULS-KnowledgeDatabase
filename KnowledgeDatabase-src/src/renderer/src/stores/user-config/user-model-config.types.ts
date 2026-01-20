/**
 * 模型配置相关类型定义（局部类型，不跨进程）
 * 用于 UI 状态管理
 */

export type ProviderType = 'openai' | 'gemini' | 'oneapi'
export type ProviderIcon = 'openai' | 'server' | 'box'

export interface ModelProvider {
  id: string
  type: ProviderType
  name: string
  apiKey: string
  baseUrl: string
  icon: ProviderIcon
  enabled: boolean
  models: Model[]
}

export interface Model {
  id: string
  name: string
  group?: string // 分组名称，如 "deepseek", "gemini 2.5" 等
  enabled: boolean
}

export interface RemoteModel {
  id: string
  object: string
  created: number
  owned_by: string
}

export interface RemoteModelGroups {
  [groupName: string]: RemoteModel[]
}

export interface ProviderTypeOption {
  id: ProviderType
  name: string
  description: string
  available: boolean
}

export interface NewProviderForm {
  type: ProviderType
  name: string
}

export interface NewModelForm {
  id: string
  name: string
  group?: string // 分组名称
}

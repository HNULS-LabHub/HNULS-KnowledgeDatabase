import type { APIResponse } from './index'

export type ModelProtocol = 'openai' | 'google' | 'anthropic' | 'generic-rest'
export type AuthScheme = 'apiKey' | 'bearer' | 'oauth2' | 'none'
export type ModelKind = 'chat' | 'embedding' | 'image' | 'audio'
export type ModelSource = 'remote' | 'manual'

export interface ProviderConfig {
  id: string
  displayName: string
  protocol: ModelProtocol
  baseUrl: string
  auth: {
    scheme: AuthScheme
    apiKeyRef?: string
    extra?: Record<string, unknown>
  }
  capabilities?: Array<'chat' | 'embedding' | 'image' | 'audio' | 'tools'>
  enabled: boolean
  modelsEndpoint: string
  protocolOptions?: Record<string, unknown>
}

export interface ModelConfig {
  id: string
  displayName: string
  providerId: string
  protocol: ModelProtocol
  providerModelName: string
  kind: ModelKind
  maxTokens?: number
  tags?: string[]
  defaultParams?: Record<string, unknown>
  aliases?: string[]
  source: ModelSource
}

export interface ModelWithProvider {
  model: ModelConfig
  provider: ProviderConfig
}

/**
 * 模型配置 API（Preload）
 *
 * Channel Prefix: modelConfig
 */
export interface ModelConfigAPI {
  getproviders: () => Promise<APIResponse<ProviderConfig[]>>
  getmodels: () => Promise<APIResponse<ModelConfig[]>>
  getmodelwithprovider: (modelIdOrAlias: string) => Promise<APIResponse<ModelWithProvider>>
  getconfigfilepath: () => Promise<APIResponse<string>>
  syncremotemodels: (providerId: string) => Promise<APIResponse<boolean>>
  refreshallremotemodels: () => Promise<APIResponse<boolean>>
}

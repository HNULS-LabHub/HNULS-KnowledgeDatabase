export interface PersistedModelConfig {
  id: string
  displayName: string
  group?: string
}

export type ModelProviderProtocol = 'openai'

export interface PersistedModelProviderConfig {
  id: string
  name: string
  protocol: ModelProviderProtocol
  enabled: boolean
  baseUrl: string
  apiKey: string
  defaultHeaders?: Record<string, string>
  models: PersistedModelConfig[]
}

export interface ModelConfig {
  version: number
  updatedAt: string
  activeProviderId?: string | null
  providers: PersistedModelProviderConfig[]
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  activeProviderId: null,
  providers: []
}

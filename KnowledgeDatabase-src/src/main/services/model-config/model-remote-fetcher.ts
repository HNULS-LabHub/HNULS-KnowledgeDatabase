import type { ModelConfig, ModelKind, ModelProtocol, ProviderConfig } from './types'

/**
 * ModelRemoteFetcher
 * - 职责：只负责“从 Provider 远程拉取模型列表”
 * - 注意：这里不会决定模型怎么用于 chat/embedding；具体调用模型的业务逻辑放在各自业务 service 里
 *
 * 为什么不使用 node-fetch？
 * - 本项目未依赖 node-fetch，因此 TS 会报“找不到模块 node-fetch”
 * - Electron/Node(>=18) 默认提供全局 fetch，直接使用即可（无需额外依赖）
 */
export class ModelRemoteFetcher {
  async fetchModels(provider: ProviderConfig): Promise<ModelConfig[]> {
    const apiKeyRef = provider.auth.apiKeyRef
    const apiKey = apiKeyRef ? process.env[apiKeyRef] : undefined

    if (provider.auth.scheme !== 'none' && !apiKey) {
      throw new Error(`Missing API key for provider: ${provider.id}`)
    }

    switch (provider.protocol) {
      case 'openai':
        return this.fetchOpenAIModels(provider, apiKey ?? '')
      case 'google':
        return this.fetchGoogleModels(provider, apiKey ?? '')
      default:
        throw new Error(`Unsupported protocol for remote model fetch: ${provider.protocol}`)
    }
  }

  private async fetchOpenAIModels(
    provider: ProviderConfig,
    apiKey: string
  ): Promise<ModelConfig[]> {
    const url = `${provider.baseUrl}${provider.modelsEndpoint}`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Failed to fetch OpenAI models: ${response.status} ${text}`)
    }

    const data = (await response.json()) as { data?: Array<{ id: string; object?: string }> }
    const list = data.data ?? []

    return list.map((item) => ({
      id: item.id,
      displayName: item.id,
      providerId: provider.id,
      protocol: 'openai' as ModelProtocol,
      providerModelName: item.id,
      kind: this.inferModelKind(item.id),
      source: 'remote'
    }))
  }

  private async fetchGoogleModels(
    provider: ProviderConfig,
    apiKey: string
  ): Promise<ModelConfig[]> {
    const url = `${provider.baseUrl}${provider.modelsEndpoint}?key=${encodeURIComponent(apiKey)}`

    const response = await fetch(url)

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Failed to fetch Google models: ${response.status} ${text}`)
    }

    const data = (await response.json()) as {
      models?: Array<{ name: string; displayName?: string }>
    }

    const list = data.models ?? []

    return list.map((item) => ({
      id: item.name.replace(/^models\//, ''),
      displayName: item.displayName || item.name,
      providerId: provider.id,
      protocol: 'google' as ModelProtocol,
      providerModelName: item.name,
      kind: this.inferModelKind(item.name),
      source: 'remote'
    }))
  }

  private inferModelKind(modelName: string): ModelKind {
    const lower = modelName.toLowerCase()

    if (lower.includes('embedding') || lower.includes('embed')) {
      return 'embedding'
    }

    if (lower.includes('image') || lower.includes('vision')) {
      return 'image'
    }

    if (lower.includes('audio') || lower.includes('speech') || lower.includes('whisper')) {
      return 'audio'
    }

    return 'chat'
  }
}

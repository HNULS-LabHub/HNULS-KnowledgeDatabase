import type { ModelConfig, ModelKind, ProviderConfig } from './types'
import { ModelConfigStorage } from './model-config.storage'
import { ModelRemoteFetcher } from './model-remote-fetcher'

export class ModelConfigService {
  /**
   * 对外使用说明（main 进程其他模块）：
   *
   * ```ts
   * import { modelConfigService } from '@/main/services'
   *
   * // 1) 读取本地配置（userData/data/Model-providers.json）
   * const providers = await modelConfigService.getProviders()
   * const models = await modelConfigService.getModels()
   *
   * // 2) 根据模型 id（或别名）拿到 model + provider（业务层再决定怎么发请求）
   * const { model, provider } = await modelConfigService.getModelWithProvider('gpt-4.1-mini')
   *
   * // 3) 从 provider.baseUrl + provider.modelsEndpoint 拉取远程模型列表并写回 JSON
   * await modelConfigService.syncRemoteModels('openai-official')
   * ```
   */
  private readonly storage = new ModelConfigStorage()
  private readonly remoteFetcher = new ModelRemoteFetcher()

  /**
   * 暴露配置文件路径（用于 UI 展示或调试）
   */
  getConfigFilePath(): string {
    return this.storage.getFilePath()
  }

  async getProviders(): Promise<ProviderConfig[]> {
    const data = await this.storage.read()
    return data.providers.filter((p) => p.enabled)
  }

  async getProviderById(id: string): Promise<ProviderConfig | undefined> {
    const providers = await this.getProviders()
    return providers.find((p) => p.id === id)
  }

  async getModels(): Promise<ModelConfig[]> {
    const data = await this.storage.read()
    return data.models
  }

  async getModelByIdOrAlias(idOrAlias: string): Promise<ModelConfig | undefined> {
    const models = await this.getModels()
    return models.find((m) => m.id === idOrAlias || (m.aliases && m.aliases.includes(idOrAlias)))
  }

  async getModelsByProviderId(providerId: string): Promise<ModelConfig[]> {
    const models = await this.getModels()
    return models.filter((m) => m.providerId === providerId)
  }

  async getModelsByKind(kind: ModelKind): Promise<ModelConfig[]> {
    const models = await this.getModels()
    return models.filter((m) => m.kind === kind)
  }

  async getModelWithProvider(
    modelIdOrAlias: string
  ): Promise<{ model: ModelConfig; provider: ProviderConfig }> {
    const model = await this.getModelByIdOrAlias(modelIdOrAlias)
    if (!model) {
      throw new Error(`Unknown model: ${modelIdOrAlias}`)
    }
    const provider = await this.getProviderById(model.providerId)
    if (!provider) {
      throw new Error(`Provider not found: ${model.providerId}`)
    }
    return { model, provider }
  }

  async fetchRemoteModels(providerId: string): Promise<ModelConfig[]> {
    const provider = await this.getProviderById(providerId)
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`)
    }
    return this.remoteFetcher.fetchModels(provider)
  }

  async syncRemoteModels(providerId: string): Promise<void> {
    const remoteModels = await this.fetchRemoteModels(providerId)
    const data = await this.storage.read()

    const filtered = data.models.filter(
      (m) => !(m.providerId === providerId && m.source === 'remote')
    )

    data.models = [...filtered, ...remoteModels]

    await this.storage.write(data)
  }

  async refreshAllRemoteModels(): Promise<void> {
    const providers = await this.getProviders()

    for (const provider of providers) {
      try {
        await this.syncRemoteModels(provider.id)
      } catch (error) {
        // 忽略单个 provider 失败，继续刷新其它 provider
        // 记录日志由 remote fetcher/业务侧自行处理或在上层捕获
      }
    }
  }
}

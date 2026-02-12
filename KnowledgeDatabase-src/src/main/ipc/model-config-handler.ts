import { BaseIPCHandler } from './base-handler'
import { ModelConfigService } from '../services/model-config'
import { knowledgeGraphBridge } from '../services/knowledge-graph-bridge'
import type { KGModelProviderConfig } from '@shared/knowledge-graph-ipc.types'
import type { ModelConfig } from '../services/model-config/types'

function toKgProviders(config: ModelConfig): KGModelProviderConfig[] {
  return (config.providers ?? []).map((p) => ({
    id: p.id,
    protocol: p.protocol,
    baseUrl: p.baseUrl,
    apiKey: p.apiKey,
    enabled: p.enabled
  }))
}

export class ModelConfigIPCHandler extends BaseIPCHandler {
  constructor(private readonly modelConfigService: ModelConfigService) {
    super()
    this.register()
  }

  protected getChannelPrefix(): string {
    return 'modelConfig'
  }

  async handleGet(): Promise<{ success: true; data: unknown } | { success: false; error: string }> {
    const config = await this.modelConfigService.getConfig()
    return { success: true, data: config }
  }

  async handleUpdate(
    _event: unknown,
    patch: unknown
  ): Promise<{ success: true; data: unknown } | { success: false; error: string }> {
    const config = await this.modelConfigService.updateConfig(patch as any)
    knowledgeGraphBridge.updateModelProviders(toKgProviders(config))
    return { success: true, data: config }
  }

  async handleSyncmodels(
    _event: unknown,
    providerId: unknown
  ): Promise<{ success: true; data: unknown } | { success: false; error: string }> {
    if (typeof providerId !== 'string') {
      return { success: false, error: 'Invalid providerId' }
    }
    const groups = await this.modelConfigService.syncModels(providerId)
    return { success: true, data: groups }
  }
}

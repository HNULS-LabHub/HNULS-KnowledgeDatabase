import type { IpcMainInvokeEvent } from 'electron'
import { BaseIPCHandler } from './base-handler'
import { ModelConfigService } from '../services/model-config'

/**
 * 模型配置 IPC 处理器
 *
 * 说明：
 * - 这里只负责把渲染进程的请求转给 ModelConfigService（配置中心）
 * - 真实的模型调用（chat/embedding 等）应在各业务 service 中完成，与配置模块解耦
 *
 * Channel Prefix: modelConfig
 *
 * 调用示例（renderer）：
 * - window.api.modelConfig.getproviders()
 * - window.api.modelConfig.getmodels()
 * - window.api.modelConfig.getmodelwithprovider('gpt-4.1-mini')
 * - window.api.modelConfig.syncremotemodels('openai-official')
 * - window.api.modelConfig.refreshallremotemodels()
 */
export class ModelConfigIPCHandler extends BaseIPCHandler {
  constructor(private readonly modelConfigService: ModelConfigService) {
    super()
    this.register()
  }

  protected getChannelPrefix(): string {
    return 'modelConfig'
  }

  async handleGetproviders(_event: IpcMainInvokeEvent) {
    const providers = await this.modelConfigService.getProviders()
    return { success: true, data: providers }
  }

  async handleGetmodels(_event: IpcMainInvokeEvent) {
    const models = await this.modelConfigService.getModels()
    return { success: true, data: models }
  }

  async handleGetmodelwithprovider(_event: IpcMainInvokeEvent, modelIdOrAlias: string) {
    const result = await this.modelConfigService.getModelWithProvider(modelIdOrAlias)
    return { success: true, data: result }
  }

  async handleGetconfigfilepath(_event: IpcMainInvokeEvent) {
    return { success: true, data: this.modelConfigService.getConfigFilePath() }
  }

  async handleSyncremotemodels(_event: IpcMainInvokeEvent, providerId: string) {
    await this.modelConfigService.syncRemoteModels(providerId)
    return { success: true, data: true }
  }

  async handleRefreshallremotemodels(_event: IpcMainInvokeEvent) {
    await this.modelConfigService.refreshAllRemoteModels()
    return { success: true, data: true }
  }
}

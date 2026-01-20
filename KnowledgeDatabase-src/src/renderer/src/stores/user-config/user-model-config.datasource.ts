/**
 * 模型配置数据源适配器
 * 目前使用 mock，后续可切换为真实 IPC
 */
import { MOCK_INITIAL_PROVIDERS, MOCK_REMOTE_MODELS } from './user-model-config.mock'
import type { ModelProvider, RemoteModelGroups } from './user-model-config.types'

const USE_MOCK = true // 目前使用 mock

export const UserModelConfigDataSource = {
  /**
   * 获取提供商列表
   */
  async getProviders(): Promise<ModelProvider[]> {
    if (USE_MOCK) {
      // 模拟延迟
      await new Promise((resolve) => setTimeout(resolve, 300))
      return [...MOCK_INITIAL_PROVIDERS]
    }
    // TODO: 后续接入真实 IPC
    // const res = await window.api.modelConfig.getproviders()
    // if (!res.success || !res.data) {
    //   throw new Error(res.error || 'Failed to load providers')
    // }
    // return res.data
    return []
  },

  /**
   * 同步远程模型列表
   */
  async syncRemoteModels(providerId: string): Promise<RemoteModelGroups> {
    if (USE_MOCK) {
      // 模拟网络延迟
      await new Promise((resolve) => setTimeout(resolve, 1200))
      return { ...MOCK_REMOTE_MODELS }
    }
    // TODO: 后续接入真实 IPC
    // const res = await window.api.modelConfig.syncremotemodels(providerId)
    // if (!res.success || !res.data) {
    //   throw new Error(res.error || 'Failed to sync remote models')
    // }
    // return res.data
    return {}
  },

  /**
   * 保存提供商配置
   */
  async saveProviders(providers: ModelProvider[]): Promise<void> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      return
    }
    // TODO: 后续接入真实 IPC
    // const res = await window.api.modelConfig.saveproviders(providers)
    // if (!res.success) {
    //   throw new Error(res.error || 'Failed to save providers')
    // }
  }
}

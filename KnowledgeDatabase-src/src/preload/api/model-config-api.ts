/**
 * 模型配置服务 API（Preload）
 *
 * 渲染进程调用范例：
 * ```ts
 * // 1) 获取所有启用的 providers
 * const p = await window.api.modelConfig.getproviders()
 * if (p.success) console.log(p.data)
 *
 * // 2) 获取本地 models（来自 userData/data/Model-providers.json）
 * const m = await window.api.modelConfig.getmodels()
 *
 * // 3) 获取 model + provider（业务层拿到后再决定怎么请求模型）
 * const mp = await window.api.modelConfig.getmodelwithprovider('gpt-4.1-mini')
 *
 * // 4) 同步远程模型列表（访问 provider.baseUrl + provider.modelsEndpoint）
 * await window.api.modelConfig.syncremotemodels('openai-official')
 * ```
 */
import { ipcRenderer } from 'electron'
import type { ModelConfigAPI } from '../types'

export const modelConfigAPI: ModelConfigAPI = {
  getproviders: () => {
    return ipcRenderer.invoke('modelConfig:getproviders')
  },
  getmodels: () => {
    return ipcRenderer.invoke('modelConfig:getmodels')
  },
  getmodelwithprovider: (modelIdOrAlias: string) => {
    return ipcRenderer.invoke('modelConfig:getmodelwithprovider', modelIdOrAlias)
  },
  getconfigfilepath: () => {
    return ipcRenderer.invoke('modelConfig:getconfigfilepath')
  },
  syncremotemodels: (providerId: string) => {
    return ipcRenderer.invoke('modelConfig:syncremotemodels', providerId)
  },
  refreshallremotemodels: () => {
    return ipcRenderer.invoke('modelConfig:refreshallremotemodels')
  }
}

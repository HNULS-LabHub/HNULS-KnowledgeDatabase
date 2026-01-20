import { ipcRenderer } from 'electron'
import type { ModelConfig, ModelConfigAPI } from '../types'

export const modelConfigAPI: ModelConfigAPI = {
  get: () => {
    return ipcRenderer.invoke('modelConfig:get')
  },
  update: (patch: Partial<ModelConfig>) => {
    return ipcRenderer.invoke('modelConfig:update', patch)
  },
  syncModels: (providerId: string) => {
    // BaseIPCHandler 会把 handleSyncModels 注册成 'syncmodels'（全小写）
    return ipcRenderer.invoke('modelConfig:syncmodels', providerId)
  }
}

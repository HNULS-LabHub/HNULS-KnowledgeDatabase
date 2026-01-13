import { ipcRenderer } from 'electron'
import type { UserConfig, UserConfigAPI } from '../types'

export const userConfigAPI: UserConfigAPI = {
  get: () => {
    return ipcRenderer.invoke('userConfig:get')
  },
  update: (patch: Partial<UserConfig>) => {
    return ipcRenderer.invoke('userConfig:update', patch)
  }
}

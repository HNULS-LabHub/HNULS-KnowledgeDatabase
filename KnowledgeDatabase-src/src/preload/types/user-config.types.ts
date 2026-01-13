import type { APIResponse } from './index'

export interface MinerUConfig {
  apiKey: string
}

export interface UserConfig {
  version: number
  updatedAt: string
  minerU: MinerUConfig
}

export interface UserConfigAPI {
  get: () => Promise<APIResponse<UserConfig>>
  update: (patch: Partial<UserConfig>) => Promise<APIResponse<UserConfig>>
}

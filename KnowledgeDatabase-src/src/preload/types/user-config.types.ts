import type { APIResponse } from './index'
import type { UserConfig } from '@shared/user-config.types'

export interface UserConfigAPI {
  get: () => Promise<APIResponse<UserConfig>>
  update: (patch: Partial<UserConfig>) => Promise<APIResponse<UserConfig>>
}

export type { MinerUConfig, UserEmbeddingConfig, UserConfig } from '@shared/user-config.types'

export interface MinerUConfig {
  apiKey: string
}

export interface UserConfig {
  version: number
  updatedAt: string
  minerU: MinerUConfig
}

export const DEFAULT_USER_CONFIG: UserConfig = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  minerU: {
    apiKey: ''
  }
}

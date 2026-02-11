import type {
  KgTaskQueryParams,
  KgTaskQueryResult,
  KgChunkQueryParams,
  KgChunkQueryResult
} from '@preload/types'

export const KgMonitorMock = {
  async getTasks(_params: KgTaskQueryParams): Promise<KgTaskQueryResult> {
    return { items: [], total: 0 }
  },

  async getTaskChunks(_params: KgChunkQueryParams): Promise<KgChunkQueryResult> {
    return { items: [], total: 0 }
  },

  async cancelTask(_taskId: string): Promise<boolean> {
    return true
  },

  async retryTask(_taskId: string): Promise<boolean> {
    return true
  },

  async removeTask(_taskId: string): Promise<boolean> {
    return true
  }
}

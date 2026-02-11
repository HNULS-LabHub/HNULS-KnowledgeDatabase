import type {
  KgTaskQueryParams,
  KgTaskQueryResult,
  KgChunkQueryParams,
  KgChunkQueryResult
} from '@preload/types'
import { KgMonitorMock } from './kg-monitor.mock'

const isElectron = !!(window as any).api?.kgMonitor

export const KgMonitorDataSource = {
  async getTasks(params: KgTaskQueryParams): Promise<KgTaskQueryResult> {
    if (!isElectron) return KgMonitorMock.getTasks(params)
    return window.api.kgMonitor.getTasks(params)
  },

  async getTaskChunks(params: KgChunkQueryParams): Promise<KgChunkQueryResult> {
    if (!isElectron) return KgMonitorMock.getTaskChunks(params)
    return window.api.kgMonitor.getTaskChunks(params)
  },

  async cancelTask(taskId: string): Promise<boolean> {
    if (!isElectron) return KgMonitorMock.cancelTask(taskId)
    return window.api.kgMonitor.cancelTask(taskId)
  },

  async retryTask(taskId: string): Promise<boolean> {
    if (!isElectron) return KgMonitorMock.retryTask(taskId)
    return window.api.kgMonitor.retryTask(taskId)
  },

  async removeTask(taskId: string): Promise<boolean> {
    if (!isElectron) return KgMonitorMock.removeTask(taskId)
    return window.api.kgMonitor.removeTask(taskId)
  }
}

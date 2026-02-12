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
  },

  async pauseTask(taskId: string): Promise<boolean> {
    if (!isElectron) return KgMonitorMock.pauseTask(taskId)
    return window.api.kgMonitor.pauseTask(taskId)
  },

  async resumeTask(taskId: string): Promise<boolean> {
    if (!isElectron) return KgMonitorMock.resumeTask(taskId)
    return window.api.kgMonitor.resumeTask(taskId)
  },

  async retryChunk(taskId: string, chunkIndex: number): Promise<boolean> {
    if (!isElectron) return KgMonitorMock.retryChunk(taskId, chunkIndex)
    const fn = (window as any).api?.kgMonitor?.retryChunk
    if (typeof fn === 'function') return fn(taskId, chunkIndex)
    throw new Error('retryChunk API not available')
  },

  async cancelChunk(taskId: string, chunkIndex: number): Promise<boolean> {
    if (!isElectron) return KgMonitorMock.cancelChunk(taskId, chunkIndex)
    const fn = (window as any).api?.kgMonitor?.cancelChunk
    if (typeof fn === 'function') return fn(taskId, chunkIndex)
    throw new Error('cancelChunk API not available')
  },

  async removeChunk(taskId: string, chunkIndex: number): Promise<boolean> {
    if (!isElectron) return KgMonitorMock.removeChunk(taskId, chunkIndex)
    const fn = (window as any).api?.kgMonitor?.removeChunk
    if (typeof fn === 'function') return fn(taskId, chunkIndex)
    throw new Error('removeChunk API not available')
  }
}

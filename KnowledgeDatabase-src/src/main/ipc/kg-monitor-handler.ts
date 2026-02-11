/**
 * @file 知识图谱监控 IPC Handler
 * @description 处理 Renderer ↔ Main 的知识图谱监控相关 IPC 通信
 */

import { IpcMainInvokeEvent } from 'electron'
import { BaseIPCHandler } from './base-handler'
import { KgMonitorService } from '../services/knowledge-graph-monitor/kg-monitor-service'
import { logger } from '../services/logger'
import type {
  KgTaskQueryParams,
  KgTaskQueryResult,
  KgChunkQueryParams,
  KgChunkQueryResult
} from '../../preload/types/kg-monitor.types'

export class KgMonitorIPCHandler extends BaseIPCHandler {
  private service: KgMonitorService

  constructor(service: KgMonitorService) {
    super()
    this.service = service
    this.register()
  }

  protected getChannelPrefix(): string {
    return 'kg-monitor'
  }

  async handleGettasks(
    _event: IpcMainInvokeEvent,
    params: KgTaskQueryParams
  ): Promise<KgTaskQueryResult> {
    try {
      return await this.service.getTasks(params)
    } catch (error) {
      logger.error('[KgMonitorIPC] gettasks failed', error)
      throw error
    }
  }

  async handleGetchunks(
    _event: IpcMainInvokeEvent,
    params: KgChunkQueryParams
  ): Promise<KgChunkQueryResult> {
    try {
      return await this.service.getTaskChunks(params)
    } catch (error) {
      logger.error('[KgMonitorIPC] getchunks failed', error)
      throw error
    }
  }

  async handleCancel(_event: IpcMainInvokeEvent, taskId: string): Promise<boolean> {
    try {
      return await this.service.cancelTask(taskId)
    } catch (error) {
      logger.error('[KgMonitorIPC] cancel failed', error)
      throw error
    }
  }

  async handleRetry(_event: IpcMainInvokeEvent, taskId: string): Promise<boolean> {
    try {
      return await this.service.retryTask(taskId)
    } catch (error) {
      logger.error('[KgMonitorIPC] retry failed', error)
      throw error
    }
  }

  async handleRemove(_event: IpcMainInvokeEvent, taskId: string): Promise<boolean> {
    try {
      return await this.service.removeTask(taskId)
    } catch (error) {
      logger.error('[KgMonitorIPC] remove failed', error)
      throw error
    }
  }
}

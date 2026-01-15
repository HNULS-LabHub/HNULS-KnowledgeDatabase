import { IpcMainInvokeEvent } from 'electron'
import { BaseIPCHandler } from './base-handler'
import { MinerUParserService } from '../services/mineru-parser'
import type {
  MinerUStartParsingRequest,
  MinerUStartParsingResponse,
  MinerUParsingProgressEvent
} from '../services/mineru-parser'

export class MinerUIPCHandler extends BaseIPCHandler {
  constructor(private readonly minerUParserService: MinerUParserService) {
    super()
    this.register()
  }

  protected getChannelPrefix(): string {
    return 'mineru'
  }

  async handleStartparsing(
    _event: IpcMainInvokeEvent,
    req: MinerUStartParsingRequest
  ): Promise<{ success: boolean; data?: MinerUStartParsingResponse; error?: string }> {
    try {
      const data = await this.minerUParserService.startParsing(req)
      return { success: true, data }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
    }
  }

  async handleGetstatus(
    _event: IpcMainInvokeEvent,
    fileKey: string
  ): Promise<{ success: boolean; data?: MinerUParsingProgressEvent; error?: string }> {
    try {
      const data = this.minerUParserService.getStatus(fileKey)
      if (!data) return { success: false, error: 'Not found' }
      return { success: true, data }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
    }
  }

  async handleGetfileparsingstate(
    _event: IpcMainInvokeEvent,
    req: { knowledgeBaseId: number; fileRelativePath: string }
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const data = await this.minerUParserService.getFileParsingState(req)
      return { success: true, data }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
    }
  }

  async handleSetactiveversion(
    _event: IpcMainInvokeEvent,
    req: { knowledgeBaseId: number; fileRelativePath: string; versionId: string }
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const data = await this.minerUParserService.setActiveVersion(req)
      return { success: true, data }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
    }
  }
}

import { ipcRenderer } from 'electron'
import type {
  MinerUAPI,
  MinerUStartParsingRequest,
  MinerUStartParsingResponse,
  MinerUParsingProgressEvent,
  MinerUGetFileParsingStateRequest,
  MinerUFileParsingState,
  MinerUSetActiveVersionRequest,
  APIResponse
} from '../types'

export const minerUAPI: MinerUAPI & {
  getFileParsingState: (
    req: MinerUGetFileParsingStateRequest
  ) => Promise<APIResponse<MinerUFileParsingState>>
  setActiveVersion: (
    req: MinerUSetActiveVersionRequest
  ) => Promise<APIResponse<MinerUFileParsingState>>
} = {
  startParsing: (
    req: MinerUStartParsingRequest
  ): Promise<APIResponse<MinerUStartParsingResponse>> => {
    return ipcRenderer.invoke('mineru:startparsing', req)
  },

  getStatus: (fileKey: string): Promise<APIResponse<MinerUParsingProgressEvent>> => {
    return ipcRenderer.invoke('mineru:getstatus', fileKey)
  },

  getFileParsingState: (
    req: MinerUGetFileParsingStateRequest
  ): Promise<APIResponse<MinerUFileParsingState>> => {
    return ipcRenderer.invoke('mineru:getfileparsingstate', req)
  },

  setActiveVersion: (
    req: MinerUSetActiveVersionRequest
  ): Promise<APIResponse<MinerUFileParsingState>> => {
    return ipcRenderer.invoke('mineru:setactiveversion', req)
  },

  onProgress: (callback: (evt: MinerUParsingProgressEvent) => void): (() => void) => {
    const handler = (_event: any, evt: MinerUParsingProgressEvent) => {
      callback(evt)
    }
    ipcRenderer.on('mineru:progress', handler)
    return () => {
      ipcRenderer.removeListener('mineru:progress', handler)
    }
  }
}

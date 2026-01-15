import type { APIResponse } from './index'

export interface MinerUFileParsingStateVersion {
  id: string
  state: 'waiting-file' | 'pending' | 'running' | 'converting' | 'done' | 'failed'
  createdAt: string
  updatedAt: string
  batchId?: string
  errMsg?: string
}

export interface MinerUFileParsingState {
  fileKey: string
  fileName: string
  docName: string
  activeVersionId: string | null
  versions: MinerUFileParsingStateVersion[]
  progress?: number
  state?: MinerUFileParsingStateVersion['state']
  extractedPages?: number
  totalPages?: number
  updatedAt: string
}

export interface MinerUGetFileParsingStateRequest {
  knowledgeBaseId: number
  fileRelativePath: string
}

export interface MinerUSetActiveVersionRequest {
  knowledgeBaseId: number
  fileRelativePath: string
  versionId: string
}

export interface MinerUFileStateAPI {
  getFileParsingState: (req: MinerUGetFileParsingStateRequest) => Promise<APIResponse<MinerUFileParsingState>>
  setActiveVersion: (req: MinerUSetActiveVersionRequest) => Promise<APIResponse<MinerUFileParsingState>>
}

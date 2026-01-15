import * as path from 'path'
import { safeDocName } from './util'
import type { MinerUDocMeta } from './meta-store'

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

export function toFileParsingState(params: {
  fileKey: string
  fileName: string
  meta: MinerUDocMeta
  // 当前 active 版本的实时状态（可能来自任务）
  runtime?: {
    state?: MinerUFileParsingStateVersion['state']
    progress?: number
    extractedPages?: number
    totalPages?: number
    updatedAt?: string
  }
}): MinerUFileParsingState {
  const versions = Object.values(params.meta.versions)
    .map((v) => ({
      id: v.id,
      state: v.state,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
      batchId: v.batchId,
      errMsg: v.errMsg
    }))
    .sort((a, b) => {
      const na = Number(a.id.replace('version-', ''))
      const nb = Number(b.id.replace('version-', ''))
      if (Number.isFinite(na) && Number.isFinite(nb)) return nb - na
      return b.updatedAt.localeCompare(a.updatedAt)
    })

  return {
    fileKey: params.fileKey,
    fileName: params.fileName,
    docName: safeDocName(path.parse(params.fileName).name),
    activeVersionId: params.meta.activeVersionId,
    versions,
    progress: params.runtime?.progress,
    state: params.runtime?.state,
    extractedPages: params.runtime?.extractedPages,
    totalPages: params.runtime?.totalPages,
    updatedAt: params.runtime?.updatedAt || params.meta.updatedAt
  }
}

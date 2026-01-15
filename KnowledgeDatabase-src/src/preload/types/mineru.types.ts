import type { APIResponse } from './index'

export type MinerUTaskState =
  | 'waiting-file'
  | 'pending'
  | 'running'
  | 'converting'
  | 'done'
  | 'failed'

export interface MinerUExtractProgress {
  extracted_pages: number
  total_pages: number
  start_time?: string
}

export interface MinerUBatchExtractResultItem {
  file_name: string
  state: MinerUTaskState
  err_msg?: string
  full_zip_url?: string
  data_id?: string
  extract_progress?: MinerUExtractProgress
}

export interface MinerUBatchStatus {
  batch_id: string
  extract_result: MinerUBatchExtractResultItem[]
}

export interface MinerUStartParsingRequest {
  knowledgeBaseId: number
  fileRelativePath: string
  modelVersion?: 'pipeline' | 'vlm'
  enableFormula?: boolean
  enableTable?: boolean
  isOcr?: boolean
  language?: string
  pageRanges?: string
}

export interface MinerUStartParsingResponse {
  fileKey: string
  versionId: string
  batchId: string
}

export interface MinerUParsingProgressEvent {
  fileKey: string
  versionId: string
  batchId: string
  state: MinerUTaskState
  extractedPages?: number
  totalPages?: number
  progress?: number
  errMsg?: string
  fullZipUrl?: string
  updatedAt: string
}

export interface MinerUAPI {
  startParsing: (req: MinerUStartParsingRequest) => Promise<APIResponse<MinerUStartParsingResponse>>
  getStatus: (fileKey: string) => Promise<APIResponse<MinerUParsingProgressEvent>>
  onProgress: (callback: (evt: MinerUParsingProgressEvent) => void) => () => void
}

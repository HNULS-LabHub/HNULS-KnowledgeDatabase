export type MinerUTaskState =
  | 'waiting-file'
  | 'pending'
  | 'running'
  | 'converting'
  | 'done'
  | 'failed'

export interface MinerUBatchExtractResultItem {
  file_name: string
  state: MinerUTaskState
  err_msg?: string
  full_zip_url?: string
  data_id?: string
  extract_progress?: {
    extracted_pages: number
    total_pages: number
    start_time?: string
  }
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
  /** 前端预生成的监控任务 ID，用于前后端跟踪同一任务 */
  monitorTaskId?: string
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

export interface MinerUTaskRecord {
  fileKey: string
  knowledgeBaseId: number
  fileRelativePath: string
  fileName: string
  versionId: string
  batchId: string
  state: MinerUTaskState
  extractedPages?: number
  totalPages?: number
  fullZipUrl?: string
  errMsg?: string
  updatedAt: string
  createdAt: string
  /** 全局监控任务 ID */
  monitorTaskId?: string
}

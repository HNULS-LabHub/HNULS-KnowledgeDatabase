/**
 * 分块服务类型定义（Preload）
 */
import type { APIResponse } from './index'
import type { ChunkingRequest, GetChunkingResultRequest, ChunkingResult } from '@shared/chunking.types'

export interface ChunkingAPI {
  chunkDocument: (req: ChunkingRequest) => Promise<APIResponse<ChunkingResult>>
  getChunkingResult: (req: GetChunkingResultRequest) => Promise<APIResponse<ChunkingResult | null>>
}

export type {
  ChunkingConfig,
  Chunk,
  ChunkingResult,
  ChunkingRequest,
  GetChunkingResultRequest
} from '@shared/chunking.types'

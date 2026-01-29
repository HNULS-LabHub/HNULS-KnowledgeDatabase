import type {
  ChunkingConfig,
  Chunk,
  ChunkingResult,
  ChunkingRequest,
  GetChunkingResultRequest
} from '@shared/chunking.types'

export interface FileChunkingState {
  fileKey: string
  config: ChunkingConfig
  chunks: Chunk[]
  lastUpdated?: string
}

export type {
  ChunkingConfig,
  Chunk,
  ChunkingResult,
  ChunkingRequest,
  GetChunkingResultRequest
} from '@shared/chunking.types'

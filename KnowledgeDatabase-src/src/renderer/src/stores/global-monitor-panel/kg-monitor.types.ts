import type { KgTaskStatus, KgChunkStatus, KgTaskRecord, KgChunkRecord } from '@preload/types'

export type { KgTaskStatus, KgChunkStatus, KgTaskRecord, KgChunkRecord }

export type KgTaskSortBy = 'updatedAt' | 'createdAt' | 'fileKey' | 'status'
export type KgSortDir = 'asc' | 'desc'

export interface KgTaskFilters {
  status: KgTaskStatus | 'all'
  fileKey: string
  sortBy: KgTaskSortBy
  sortDir: KgSortDir
}

export interface KgPaginationState {
  page: number
  pageSize: number
  total: number
}

export interface KgChunkState {
  items: KgChunkRecord[]
  total: number
  page: number
  pageSize: number
  statusFilter: KgChunkStatus | 'all'
  loading: boolean
}

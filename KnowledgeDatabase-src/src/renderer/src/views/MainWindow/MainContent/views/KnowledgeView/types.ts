export interface KnowledgeBase {
  id: number
  name: string
  description: string
  docCount: number
  chunkCount: number // 分片数量（原向量数）
  lastUpdated: string
  createdAt: string
  color: string // Hex
  icon: string // SVG string
}

export type ViewType = 'list' | 'card' | 'tree'

export type NavItem = 'files' | 'search' | 'logs' | 'settings'

export interface FileNode {
  id: string | number
  name: string
  type: 'file' | 'folder'
  size?: string
  uploadTime?: string
  updateTime?: string
  status?: 'parsed' | 'parsing' | 'failed' | 'pending'
  chunkCount?: number
  path?: string
  extension?: string
  // 解析相关元数据
  metadata?: {
    tokenCount?: number
    embeddingModel?: string
    parseTime?: string
    md5?: string
  }
}

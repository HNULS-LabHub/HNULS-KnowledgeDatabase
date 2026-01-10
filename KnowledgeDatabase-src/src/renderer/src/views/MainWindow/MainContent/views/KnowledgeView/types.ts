export interface KnowledgeBase {
  id: number
  name: string
  description: string
  docCount: number
  vectorCount: string
  lastUpdated: string
  color: string // Hex
  icon: string  // SVG string
}

export type ViewType = 'list' | 'card' | 'tree'

export type NavItem = 'files' | 'search' | 'logs' | 'settings'

import type { FileParsingState, ParsingVersion } from './parsing.types'

const pad2 = (n: number) => String(n).padStart(2, '0')

export const mockParsingStateByFileKey = (fileKey: string): FileParsingState => {
  const versions: ParsingVersion[] = Array.from({ length: 15 }).map((_, i) => ({
    id: `v1.0.${15 - i}`,
    name: i === 0 ? 'Latest Auto-Save' : `Snapshot ${15 - i}`,
    timestamp: `05-${pad2(30 - i)} 14:20`,
    status: i === 0 ? 'active' : 'archived'
  }))

  return {
    fileKey,
    activeVersionId: versions[0]?.id ?? null,
    versions
  }
}

export const mockStartNewVersion = (state: FileParsingState): FileParsingState => {
  const newVersion: ParsingVersion = {
    id: `v1.0.${Math.max(0, state.versions.length + 1)}`,
    name: 'Latest Auto-Save',
    timestamp: new Date().toLocaleString(),
    status: 'active'
  }

  const nextVersions = [newVersion, ...state.versions].map((v, idx) => ({
    ...v,
    status: idx === 0 ? 'active' : 'archived'
  }))

  return {
    ...state,
    activeVersionId: newVersion.id,
    versions: nextVersions
  }
}

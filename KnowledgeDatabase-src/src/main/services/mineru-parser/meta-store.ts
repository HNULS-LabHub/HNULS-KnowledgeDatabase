import * as fs from 'fs/promises'
import * as path from 'path'
import { safeDocName } from './util'

export type MinerUVersionState = 'waiting-file' | 'pending' | 'running' | 'converting' | 'done' | 'failed'

export interface MinerUDocVersionMeta {
  id: string
  state: MinerUVersionState
  batchId?: string
  errMsg?: string
  createdAt: string
  updatedAt: string
}

export interface MinerUDocMeta {
  schemaVersion: 1
  docName: string
  fileName: string
  activeVersionId: string | null
  versions: Record<string, MinerUDocVersionMeta>
  updatedAt: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function metaPath(kbRoot: string, docName: string): string {
  return path.join(kbRoot, '.ParserDocument', docName, 'meta.json')
}

function versionsDir(kbRoot: string, docName: string): string {
  return path.join(kbRoot, '.ParserDocument', docName)
}

export class MinerUMetaStore {
  async loadOrInit(params: { kbRoot: string; fileName: string }): Promise<MinerUDocMeta> {
    const docName = safeDocName(path.parse(params.fileName).name)
    const p = metaPath(params.kbRoot, docName)

    const diskVersions = await this.scanDiskVersions({ kbRoot: params.kbRoot, docName })

    let meta: MinerUDocMeta | null = null
    try {
      const raw = await fs.readFile(p, 'utf-8')
      meta = JSON.parse(raw) as MinerUDocMeta
    } catch {
      meta = null
    }

    if (!meta) {
      meta = {
        schemaVersion: 1,
        docName,
        fileName: params.fileName,
        activeVersionId: diskVersions[0] ?? null,
        versions: {},
        updatedAt: nowIso()
      }
    }

    meta.fileName = params.fileName
    meta.docName = docName

    // 合并磁盘版本
    for (const v of diskVersions) {
      if (!meta.versions[v]) {
        meta.versions[v] = {
          id: v,
          state: 'done',
          createdAt: nowIso(),
          updatedAt: nowIso()
        }
      }
    }

    // active 不存在时回退
    if (meta.activeVersionId && !diskVersions.includes(meta.activeVersionId) && !meta.versions[meta.activeVersionId]) {
      meta.activeVersionId = diskVersions[0] ?? null
    }

    if (!meta.activeVersionId) {
      meta.activeVersionId = diskVersions[0] ?? null
    }

    meta.updatedAt = nowIso()
    await this.save(params.kbRoot, meta)

    return meta
  }

  async save(kbRoot: string, meta: MinerUDocMeta): Promise<void> {
    const dir = versionsDir(kbRoot, meta.docName)
    await fs.mkdir(dir, { recursive: true })

    const p = metaPath(kbRoot, meta.docName)
    const tmp = `${p}.tmp`
    const content = JSON.stringify(meta, null, 2)
    await fs.writeFile(tmp, content, 'utf-8')
    await fs.rename(tmp, p)
  }

  async scanDiskVersions(params: { kbRoot: string; docName: string }): Promise<string[]> {
    const dir = versionsDir(params.kbRoot, params.docName)
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      return entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .filter((name) => /^version-\d+$/.test(name))
        .sort((a, b) => {
          const na = Number(a.replace('version-', ''))
          const nb = Number(b.replace('version-', ''))
          return nb - na
        })
    } catch {
      return []
    }
  }

  async setActiveVersion(params: { kbRoot: string; fileName: string; versionId: string }): Promise<MinerUDocMeta> {
    const meta = await this.loadOrInit({ kbRoot: params.kbRoot, fileName: params.fileName })
    if (!meta.versions[params.versionId]) {
      // 允许切换到不存在目录但已知版本（例如进行中）
      meta.versions[params.versionId] = {
        id: params.versionId,
        state: 'running',
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
    }
    meta.activeVersionId = params.versionId
    meta.updatedAt = nowIso()
    meta.versions[params.versionId].updatedAt = nowIso()
    await this.save(params.kbRoot, meta)
    return meta
  }

  async allocateNextVersion(params: { kbRoot: string; fileName: string }): Promise<{ meta: MinerUDocMeta; versionId: string }>
  {
    const meta = await this.loadOrInit({ kbRoot: params.kbRoot, fileName: params.fileName })

    const existingIds = Object.keys(meta.versions)
    const max = existingIds
      .map((v) => Number(v.replace('version-', '')))
      .filter((n) => Number.isFinite(n))
      .reduce((acc, n) => Math.max(acc, n), 0)

    const versionId = `version-${max + 1}`

    meta.versions[versionId] = {
      id: versionId,
      state: 'waiting-file',
      createdAt: nowIso(),
      updatedAt: nowIso()
    }

    meta.activeVersionId = versionId
    meta.updatedAt = nowIso()

    await this.save(params.kbRoot, meta)

    return { meta, versionId }
  }

  async updateVersion(params: {
    kbRoot: string
    fileName: string
    versionId: string
    patch: Partial<MinerUDocVersionMeta>
  }): Promise<MinerUDocMeta> {
    const meta = await this.loadOrInit({ kbRoot: params.kbRoot, fileName: params.fileName })
    const current = meta.versions[params.versionId] || {
      id: params.versionId,
      state: 'running' as MinerUVersionState,
      createdAt: nowIso(),
      updatedAt: nowIso()
    }

    meta.versions[params.versionId] = {
      ...current,
      ...params.patch,
      id: params.versionId,
      updatedAt: nowIso()
    }

    meta.updatedAt = nowIso()
    await this.save(params.kbRoot, meta)
    return meta
  }
}

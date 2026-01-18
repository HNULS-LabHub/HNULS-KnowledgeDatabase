/**
 * 分块元数据存储
 *
 * 存储分块结果的元数据（配置、版本等）
 * 文件位置：.ChunkDocument/{docName}/meta.json
 */
import * as fs from 'fs/promises'
import * as path from 'path'
import { getChunkDocDir } from './util'
import type { ChunkingConfig, ChunkingResult } from './types'

function nowIso(): string {
  return new Date().toISOString()
}

function metaPath(kbRoot: string, docName: string): string {
  return path.join(kbRoot, '.ChunkDocument', docName, 'meta.json')
}

export interface ChunkDocMeta {
  schemaVersion: 1
  docName: string
  fileName: string
  /** 当前活跃的配置（用于快速查询） */
  activeConfig: ChunkingConfig | null
  /** 分块结果历史（按配置的 JSON 字符串作为 key） */
  results: Record<string, ChunkingResult>
  updatedAt: string
}

export class ChunkMetaStore {
  /**
   * 加载或初始化分块元数据
   */
  async loadOrInit(params: { kbRoot: string; fileName: string }): Promise<ChunkDocMeta> {
    const { docName } = getChunkDocDir(params.kbRoot, params.fileName)
    const p = metaPath(params.kbRoot, docName)

    let meta: ChunkDocMeta | null = null
    try {
      const raw = await fs.readFile(p, 'utf-8')
      meta = JSON.parse(raw) as ChunkDocMeta
    } catch {
      meta = null
    }

    if (!meta) {
      meta = {
        schemaVersion: 1,
        docName,
        fileName: params.fileName,
        activeConfig: null,
        results: {},
        updatedAt: nowIso()
      }
    }

    meta.fileName = params.fileName
    meta.docName = docName
    meta.updatedAt = nowIso()

    await this.save(params.kbRoot, meta)
    return meta
  }

  /**
   * 保存元数据
   */
  async save(kbRoot: string, meta: ChunkDocMeta): Promise<void> {
    const { chunkDocDir } = getChunkDocDir(kbRoot, meta.fileName)
    await fs.mkdir(chunkDocDir, { recursive: true })

    const p = metaPath(kbRoot, meta.docName)
    const tmp = `${p}.tmp`
    const content = JSON.stringify(meta, null, 2)
    await fs.writeFile(tmp, content, 'utf-8')
    await fs.rename(tmp, p)
  }

  /**
   * 保存分块结果
   */
  async saveResult(params: {
    kbRoot: string
    fileName: string
    result: ChunkingResult
  }): Promise<void> {
    const meta = await this.loadOrInit({ kbRoot: params.kbRoot, fileName: params.fileName })

    // 使用配置的 JSON 字符串作为 key
    const configKey = JSON.stringify(params.result.config)

    meta.results[configKey] = params.result
    meta.activeConfig = params.result.config
    meta.updatedAt = nowIso()

    await this.save(params.kbRoot, meta)
  }

  /**
   * 获取分块结果
   */
  async getResult(params: {
    kbRoot: string
    fileName: string
    config: ChunkingConfig
  }): Promise<ChunkingResult | null> {
    const meta = await this.loadOrInit({ kbRoot: params.kbRoot, fileName: params.fileName })

    const configKey = JSON.stringify(params.config)
    return meta.results[configKey] || null
  }
}

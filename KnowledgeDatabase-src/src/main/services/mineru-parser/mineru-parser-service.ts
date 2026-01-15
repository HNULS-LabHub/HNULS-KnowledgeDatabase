import { app, webContents } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import { logger } from '../logger'
import { KnowledgeLibraryService } from '../knowledgeBase-library/knowledge-library-service'
import { DocumentService } from '../knowledgeBase-library/document-service'
import { UserConfigService } from '../user-config-service/user-config-service'
import { MinerUApiClient } from './mineru-api-client'
import { getDocDir, dirExists } from './util'
import { MinerUMetaStore } from './meta-store'
import { toFileParsingState, type MinerUFileParsingState } from './file-parsing-state'
import type {
  MinerUParsingProgressEvent,
  MinerUStartParsingRequest,
  MinerUStartParsingResponse,
  MinerUTaskRecord,
  MinerUTaskState
} from './types'

function nowIso(): string {
  return new Date().toISOString()
}

function computeProgress(extracted?: number, total?: number): number | undefined {
  if (!total || total <= 0) return undefined
  if (typeof extracted !== 'number') return undefined
  const p = (extracted / total) * 100
  return Math.max(0, Math.min(100, p))
}

function stateFallbackProgress(state: MinerUTaskState): number {
  switch (state) {
    case 'waiting-file':
      return 2
    case 'pending':
      return 5
    case 'converting':
      return 10
    case 'running':
      return 15
    case 'done':
      return 100
    case 'failed':
      return 0
    default:
      return 0
  }
}

export class MinerUParserService {
  private readonly knowledgeLibraryService = new KnowledgeLibraryService()
  private readonly documentService = new DocumentService()
  private readonly userConfigService = new UserConfigService()
  private readonly metaStore = new MinerUMetaStore()

  private tasksByFileKey = new Map<string, MinerUTaskRecord>()
  private pollTimersByBatchId = new Map<string, NodeJS.Timeout>()
  private readonly persistFilePath = path.join(app.getPath('userData'), 'data', 'mineru-tasks.json')

  async initialize(): Promise<void> {
    await this.restore()
  }

  private async restore(): Promise<void> {
    try {
      const raw = await fs.readFile(this.persistFilePath, 'utf-8')
      const parsed = JSON.parse(raw) as { tasks: MinerUTaskRecord[] }
      if (!parsed?.tasks?.length) return

      for (const t of parsed.tasks) {
        this.tasksByFileKey.set(t.fileKey, t)
        if (t.state !== 'done' && t.state !== 'failed') {
          this.ensurePolling(t.batchId).catch((e) =>
            logger.error('[MinerUParserService] restore polling failed', e)
          )
        }
      }

      logger.info('[MinerUParserService] restored tasks', { count: parsed.tasks.length })
    } catch {
      // ignore
    }
  }

  private async persist(): Promise<void> {
    const tasks = Array.from(this.tasksByFileKey.values())
    await fs.mkdir(path.dirname(this.persistFilePath), { recursive: true })
    await fs.writeFile(this.persistFilePath, JSON.stringify({ tasks }, null, 2), 'utf-8')
  }

  private async purgeIfParserDirMissing(params: {
    kbRoot: string
    fileKey: string
    fileName: string
  }): Promise<boolean> {
    const { docDir } = getDocDir(params.kbRoot, params.fileName)
    const exists = await dirExists(docDir)
    if (exists) return false

    // 用户手动删除了 .ParserDocument/{docName}：以文件系统为权威，清理残留任务状态
    const task = this.tasksByFileKey.get(params.fileKey)
    if (task) {
      this.tasksByFileKey.delete(params.fileKey)
      await this.persist()
    }

    return true
  }

  async getFileParsingState(params: {
    knowledgeBaseId: number
    fileRelativePath: string
  }): Promise<MinerUFileParsingState> {
    const kb = await this.knowledgeLibraryService.getById(params.knowledgeBaseId)
    if (!kb || !kb.documentPath) {
      throw new Error(`Knowledge base ${params.knowledgeBaseId} not found or missing documentPath`)
    }

    await this.documentService.ensureKnowledgeBaseDirectory(kb.documentPath)
    const kbRoot = this.documentService.getFullDirectoryPath(kb.documentPath)

    const fileName = path.basename(params.fileRelativePath)
    const fileKey = params.fileRelativePath.replace(/\\/g, '/')

    const purged = await this.purgeIfParserDirMissing({ kbRoot, fileKey, fileName })
    if (purged) {
      return {
        fileKey,
        fileName,
        docName: getDocDir(kbRoot, fileName).docName,
        activeVersionId: null,
        versions: [],
        updatedAt: nowIso()
      }
    }

    const meta = await this.metaStore.loadOrInit({ kbRoot, fileName })

    const task = this.tasksByFileKey.get(fileKey)
    const runtime =
      task && task.versionId === meta.activeVersionId
        ? {
            state: task.state,
            progress:
              computeProgress(task.extractedPages, task.totalPages) ??
              stateFallbackProgress(task.state),
            extractedPages: task.extractedPages,
            totalPages: task.totalPages,
            updatedAt: task.updatedAt
          }
        : undefined

    return toFileParsingState({ fileKey, fileName, meta, runtime })
  }

  async setActiveVersion(params: {
    knowledgeBaseId: number
    fileRelativePath: string
    versionId: string
  }): Promise<MinerUFileParsingState> {
    const kb = await this.knowledgeLibraryService.getById(params.knowledgeBaseId)
    if (!kb || !kb.documentPath) {
      throw new Error(`Knowledge base ${params.knowledgeBaseId} not found or missing documentPath`)
    }

    await this.documentService.ensureKnowledgeBaseDirectory(kb.documentPath)
    const kbRoot = this.documentService.getFullDirectoryPath(kb.documentPath)

    const fileName = path.basename(params.fileRelativePath)
    const fileKey = params.fileRelativePath.replace(/\\/g, '/')

    const purged = await this.purgeIfParserDirMissing({ kbRoot, fileKey, fileName })
    if (purged) {
      return {
        fileKey,
        fileName,
        docName: getDocDir(kbRoot, fileName).docName,
        activeVersionId: null,
        versions: [],
        updatedAt: nowIso()
      }
    }

    const meta = await this.metaStore.setActiveVersion({
      kbRoot,
      fileName,
      versionId: params.versionId
    })

    const task = this.tasksByFileKey.get(fileKey)
    const runtime =
      task && task.versionId === meta.activeVersionId
        ? {
            state: task.state,
            progress:
              computeProgress(task.extractedPages, task.totalPages) ??
              stateFallbackProgress(task.state),
            extractedPages: task.extractedPages,
            totalPages: task.totalPages,
            updatedAt: task.updatedAt
          }
        : undefined

    return toFileParsingState({ fileKey, fileName, meta, runtime })
  }

  getStatus(fileKey: string): MinerUParsingProgressEvent | null {
    const t = this.tasksByFileKey.get(fileKey)
    if (!t) return null

    return {
      fileKey: t.fileKey,
      versionId: t.versionId,
      batchId: t.batchId,
      state: t.state,
      extractedPages: t.extractedPages,
      totalPages: t.totalPages,
      progress: computeProgress(t.extractedPages, t.totalPages) ?? stateFallbackProgress(t.state),
      errMsg: t.errMsg,
      fullZipUrl: t.fullZipUrl,
      updatedAt: t.updatedAt
    }
  }

  async startParsing(req: MinerUStartParsingRequest): Promise<MinerUStartParsingResponse> {
    const cfg = await this.userConfigService.getConfig()
    const token = cfg?.minerU?.apiKey
    if (!token) {
      throw new Error('MinerU API key is missing. Please set it in User Settings.')
    }

    const kb = await this.knowledgeLibraryService.getById(req.knowledgeBaseId)
    if (!kb || !kb.documentPath) {
      throw new Error(`Knowledge base ${req.knowledgeBaseId} not found or missing documentPath`)
    }

    await this.documentService.ensureKnowledgeBaseDirectory(kb.documentPath)

    const kbRoot = this.documentService.getFullDirectoryPath(kb.documentPath)

    const fileName = path.basename(req.fileRelativePath)
    const fileKey = req.fileRelativePath.replace(/\\/g, '/')

    await this.purgeIfParserDirMissing({ kbRoot, fileKey, fileName })

    const fileAbsPath = path.join(kbRoot, req.fileRelativePath)

    const stat = await fs.stat(fileAbsPath)
    const maxBytes = 200 * 1024 * 1024
    if (stat.size > maxBytes) {
      throw new Error('File too large (>200MB)')
    }

    const existing = this.tasksByFileKey.get(fileKey)
    if (existing && existing.state !== 'done' && existing.state !== 'failed') {
      return { fileKey, versionId: existing.versionId, batchId: existing.batchId }
    }

    const { versionId } = await this.metaStore.allocateNextVersion({ kbRoot, fileName })

    const client = new MinerUApiClient(token)

    const applyRes = await client.applyUploadUrls({
      files: [
        {
          name: fileName,
          data_id: `${req.knowledgeBaseId}:${fileKey}`,
          is_ocr: req.isOcr,
          page_ranges: req.pageRanges
        }
      ],
      model_version: req.modelVersion ?? 'vlm',
      enable_formula: req.enableFormula,
      enable_table: req.enableTable,
      language: req.language
    })

    const batchId = applyRes.batch_id
    const uploadUrl = applyRes.file_urls?.[0]
    if (!uploadUrl) {
      throw new Error('Failed to get upload url')
    }

    await this.metaStore.updateVersion({
      kbRoot,
      fileName,
      versionId,
      patch: {
        state: 'pending',
        batchId
      }
    })

    const buf = await fs.readFile(fileAbsPath)
    await client.uploadFile(uploadUrl, buf)

    const task: MinerUTaskRecord = {
      fileKey,
      knowledgeBaseId: req.knowledgeBaseId,
      fileRelativePath: req.fileRelativePath,
      fileName,
      versionId,
      batchId,
      state: 'waiting-file',
      createdAt: nowIso(),
      updatedAt: nowIso()
    }

    this.tasksByFileKey.set(fileKey, task)
    await this.persist()

    this.emitProgress(task)
    await this.ensurePolling(batchId)

    return { fileKey, versionId, batchId }
  }

  private emitProgress(task: MinerUTaskRecord): void {
    const evt: MinerUParsingProgressEvent = {
      fileKey: task.fileKey,
      versionId: task.versionId,
      batchId: task.batchId,
      state: task.state,
      extractedPages: task.extractedPages,
      totalPages: task.totalPages,
      progress:
        computeProgress(task.extractedPages, task.totalPages) ?? stateFallbackProgress(task.state),
      errMsg: task.errMsg,
      fullZipUrl: task.fullZipUrl,
      updatedAt: task.updatedAt
    }

    for (const wc of webContents.getAllWebContents()) {
      try {
        if (!wc.isDestroyed()) wc.send('mineru:progress', evt)
      } catch {
        // ignore
      }
    }
  }

  private async ensurePolling(batchId: string): Promise<void> {
    if (this.pollTimersByBatchId.has(batchId)) return

    const poll = async (): Promise<void> => {
      try {
        await this.pollOnce(batchId)
      } catch (e) {
        logger.error('[MinerUParserService] pollOnce error', e)
      }
    }

    await poll()
    const timer = setInterval(poll, 1000)
    this.pollTimersByBatchId.set(batchId, timer)
  }

  private stopPolling(batchId: string): void {
    const t = this.pollTimersByBatchId.get(batchId)
    if (t) {
      clearInterval(t)
      this.pollTimersByBatchId.delete(batchId)
    }
  }

  private async pollOnce(batchId: string): Promise<void> {
    const cfg = await this.userConfigService.getConfig()
    const token = cfg?.minerU?.apiKey
    if (!token) {
      throw new Error('MinerU API key is missing')
    }

    const client = new MinerUApiClient(token)
    const status = await client.getBatchStatus(batchId)

    for (const item of status.extract_result || []) {
      const dataId = item.data_id
      let fileKey: string | null = null

      if (dataId && typeof dataId === 'string') {
        const parts = dataId.split(':')
        if (parts.length >= 2) {
          fileKey = parts.slice(1).join(':')
        }
      }

      if (!fileKey) {
        const candidates = Array.from(this.tasksByFileKey.values()).filter(
          (t) => t.batchId === batchId && t.fileName === item.file_name
        )
        if (candidates.length === 1) fileKey = candidates[0].fileKey
      }

      if (!fileKey) continue

      const task = this.tasksByFileKey.get(fileKey)
      if (!task) continue

      const prevState = task.state

      task.state = item.state as MinerUTaskState
      task.errMsg = item.err_msg || undefined
      task.fullZipUrl = item.full_zip_url || undefined
      task.extractedPages = item.extract_progress?.extracted_pages
      task.totalPages = item.extract_progress?.total_pages
      task.updatedAt = nowIso()

      this.tasksByFileKey.set(fileKey, task)
      await this.persist()

      try {
        const kb = await this.knowledgeLibraryService.getById(task.knowledgeBaseId)
        if (kb?.documentPath) {
          const kbRoot = this.documentService.getFullDirectoryPath(kb.documentPath)
          await this.metaStore.updateVersion({
            kbRoot,
            fileName: task.fileName,
            versionId: task.versionId,
            patch: {
              state: task.state,
              errMsg: task.errMsg,
              batchId: task.batchId
            }
          })
        }
      } catch {
        // ignore
      }

      this.emitProgress(task)

      if (task.state === 'done' && task.fullZipUrl) {
        await this.handleDone(task, task.fullZipUrl)
      }

      if (task.state === 'failed') {
        logger.warn('[MinerUParserService] task failed', {
          fileKey: task.fileKey,
          err: task.errMsg
        })
      }

      if (
        (prevState !== task.state && (task.state === 'done' || task.state === 'failed')) ||
        task.state === 'done' ||
        task.state === 'failed'
      ) {
        const all = Array.from(this.tasksByFileKey.values()).filter((t) => t.batchId === batchId)
        const unfinished = all.some((t) => t.state !== 'done' && t.state !== 'failed')
        if (!unfinished) this.stopPolling(batchId)
      }
    }
  }

  private async handleDone(task: MinerUTaskRecord, zipUrl: string): Promise<void> {
    const kb = await this.knowledgeLibraryService.getById(task.knowledgeBaseId)
    if (!kb || !kb.documentPath) return

    await this.documentService.ensureKnowledgeBaseDirectory(kb.documentPath)
    const kbRoot = this.documentService.getFullDirectoryPath(kb.documentPath)

    const { docDir } = getDocDir(kbRoot, task.fileName)
    await fs.mkdir(docDir, { recursive: true })

    const tempDir = path.join(kbRoot, '.Temp', task.versionId)
    const zipPath = path.join(tempDir, 'result.zip')

    const outDir = path.join(docDir, task.versionId)

    await fs.mkdir(tempDir, { recursive: true })
    await fs.mkdir(outDir, { recursive: true })

    const cfg = await this.userConfigService.getConfig()
    const token = cfg?.minerU?.apiKey
    if (!token) throw new Error('MinerU API key is missing')

    const client = new MinerUApiClient(token)
    const buf = await client.downloadZip(zipUrl)

    await fs.writeFile(zipPath, buf)

    const { spawn } = await import('child_process')

    await new Promise<void>((resolve, reject) => {
      const p = spawn('tar', ['-xf', zipPath, '-C', outDir])
      let stderr = ''
      p.stderr.on('data', (d) => (stderr += d.toString()))
      p.on('close', (code) => {
        if (code === 0) return resolve()
        reject(new Error(stderr || `extract failed with code ${code}`))
      })
    })

    await fs.rm(zipPath, { force: true })

    await this.metaStore.updateVersion({
      kbRoot,
      fileName: task.fileName,
      versionId: task.versionId,
      patch: {
        state: 'done'
      }
    })

    task.updatedAt = nowIso()
    this.tasksByFileKey.set(task.fileKey, task)
    await this.persist()

    this.emitProgress(task)

    logger.info('[MinerUParserService] extracted', { outDir, fileKey: task.fileKey })
  }
}

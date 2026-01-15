import { logger } from '../logger'
import type { MinerUBatchStatus } from './types'

interface MinerUResponse<T> {
  code: number
  msg: string
  trace_id?: string
  data: T
}

export class MinerUApiClient {
  constructor(private readonly token: string) {}

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    }
  }

  async applyUploadUrls(params: {
    files: Array<{ name: string; data_id?: string; is_ocr?: boolean; page_ranges?: string }>
    model_version?: 'pipeline' | 'vlm'
    enable_formula?: boolean
    enable_table?: boolean
    language?: string
  }): Promise<{ batch_id: string; file_urls: string[] }> {
    const url = 'https://mineru.net/api/v4/file-urls/batch'

    const body: any = {
      files: params.files.map((f) => {
        const o: any = { name: f.name }
        if (f.data_id) o.data_id = f.data_id
        if (typeof f.is_ocr === 'boolean') o.is_ocr = f.is_ocr
        if (f.page_ranges) o.page_ranges = f.page_ranges
        return o
      })
    }

    if (params.model_version) body.model_version = params.model_version
    if (typeof params.enable_formula === 'boolean') body.enable_formula = params.enable_formula
    if (typeof params.enable_table === 'boolean') body.enable_table = params.enable_table
    if (params.language) body.language = params.language

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.headers,
        Accept: '*/*'
      },
      body: JSON.stringify(body)
    })

    const json = (await res.json()) as MinerUResponse<{ batch_id: string; file_urls: string[] }>

    if (!res.ok || json.code !== 0) {
      const msg = json?.msg || `HTTP ${res.status}`
      logger.error('[MinerUApiClient] applyUploadUrls failed', { status: res.status, msg, json })
      throw new Error(msg)
    }

    return json.data
  }

  async uploadFile(uploadUrl: string, fileBuffer: Buffer): Promise<void> {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      // 不要设置 Content-Type（按文档要求）
      body: fileBuffer
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Upload failed: HTTP ${res.status} ${text}`)
    }
  }

  async getBatchStatus(batchId: string): Promise<MinerUBatchStatus> {
    const url = `https://mineru.net/api/v4/extract-results/batch/${encodeURIComponent(batchId)}`

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: '*/*'
      }
    })

    const json = (await res.json()) as MinerUResponse<MinerUBatchStatus>

    if (!res.ok || json.code !== 0) {
      const msg = json?.msg || `HTTP ${res.status}`
      logger.error('[MinerUApiClient] getBatchStatus failed', { status: res.status, msg, json })
      throw new Error(msg)
    }

    return json.data
  }

  async downloadZip(zipUrl: string): Promise<Buffer> {
    const res = await fetch(zipUrl, { method: 'GET' })
    if (!res.ok) {
      throw new Error(`Download zip failed: HTTP ${res.status}`)
    }
    const arr = await res.arrayBuffer()
    return Buffer.from(arr)
  }
}

import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import type { ModelProvidersData } from './types'
import { logger } from '../logger'

/**
 * ModelConfigStorage
 * - 职责：只负责“配置数据”的本地存取（明文 JSON），不做任何网络请求、不做业务决策
 * - 存储位置：userData/data/Model-providers.json（与现有 data 目录用法一致）
 *
 * 文件样例（Model-providers.json）：
 * {
 *   "providers": [
 *     {
 *       "id": "openai-official",
 *       "displayName": "OpenAI 官方",
 *       "protocol": "openai",
 *       "baseUrl": "https://api.openai.com",
 *       "auth": { "scheme": "apiKey", "apiKeyRef": "OPENAI_API_KEY" },
 *       "enabled": true,
 *       "modelsEndpoint": "/v1/models",
 *       "capabilities": ["chat", "embedding", "image", "tools"]
 *     }
 *   ],
 *   "models": [
 *     {
 *       "id": "gpt-4.1-mini",
 *       "displayName": "GPT-4.1 Mini",
 *       "providerId": "openai-official",
 *       "protocol": "openai",
 *       "providerModelName": "gpt-4.1-mini",
 *       "kind": "chat",
 *       "source": "manual",
 *       "aliases": ["gpt-4.1-mini-latest"]
 *     }
 *   ]
 * }
 */
export class ModelConfigStorage {
  private cache: ModelProvidersData | null = null

  getFilePath(): string {
    return path.join(app.getPath('userData'), 'data', 'Model-providers.json')
  }

  clearCache(): void {
    this.cache = null
  }

  async read(): Promise<ModelProvidersData> {
    if (this.cache) return this.cache

    const filePath = this.getFilePath()
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      const parsed = JSON.parse(raw) as ModelProvidersData
      this.cache = parsed
      return parsed
    } catch (error) {
      logger.warn?.(
        'Model providers config not found or invalid, using empty default',
        error as Error
      )
      const empty: ModelProvidersData = { providers: [], models: [] }
      this.cache = empty
      return empty
    }
  }

  async write(data: ModelProvidersData): Promise<void> {
    const filePath = this.getFilePath()
    await fs.mkdir(path.dirname(filePath), { recursive: true })

    // 原子写入：先写临时文件，再 rename 覆盖
    const tempPath = `${filePath}.tmp`
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8')
    await fs.rename(tempPath, filePath)

    this.cache = data
  }
}

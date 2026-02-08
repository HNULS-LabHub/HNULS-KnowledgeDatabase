import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import { DEFAULT_USER_CONFIG, type UserConfig } from './types'

export class UserConfigService {
  private getConfigFilePath(): string {
    return path.join(app.getPath('userData'), 'data', 'user-config.json')
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.stat(filePath)
      return true
    } catch {
      return false
    }
  }

  async getConfig(): Promise<UserConfig> {
    const filePath = this.getConfigFilePath()

    const exists = await this.fileExists(filePath)
    if (!exists) {
      return DEFAULT_USER_CONFIG
    }

    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<UserConfig>

    return {
      ...DEFAULT_USER_CONFIG,
      ...parsed,
      minerU: {
        ...DEFAULT_USER_CONFIG.minerU,
        ...(parsed.minerU || {})
      },
      embedding: {
        ...DEFAULT_USER_CONFIG.embedding,
        ...(parsed.embedding || {})
      }
    }
  }

  async updateConfig(patch: Partial<UserConfig>): Promise<UserConfig> {
    const current = await this.getConfig()

    const updated: UserConfig = {
      ...current,
      ...patch,
      minerU: {
        ...current.minerU,
        ...(patch.minerU || {})
      },
      embedding: {
        ...current.embedding,
        ...(patch.embedding || {})
      },
      updatedAt: new Date().toISOString()
    }

    const filePath = this.getConfigFilePath()
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(updated, null, 2), 'utf-8')

    return updated
  }
}

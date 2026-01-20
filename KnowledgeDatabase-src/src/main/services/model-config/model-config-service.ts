import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import { DEFAULT_MODEL_CONFIG, type ModelConfig } from './types'

/**
 * 从远程 API 获取的模型信息（OpenAI /models 响应格式）
 */
export interface RemoteModelInfo {
  id: string
  object: string
  created: number
  owned_by: string
}

/**
 * 按分组组织的远程模型列表
 */
export interface RemoteModelGroups {
  [groupName: string]: RemoteModelInfo[]
}

export class ModelConfigService {
  private getConfigFilePath(): string {
    return path.join(app.getPath('userData'), 'data', 'model-config.json')
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.stat(filePath)
      return true
    } catch {
      return false
    }
  }

  async getConfig(): Promise<ModelConfig> {
    const filePath = this.getConfigFilePath()

    const exists = await this.fileExists(filePath)
    if (!exists) {
      return DEFAULT_MODEL_CONFIG
    }

    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<ModelConfig>

    return {
      ...DEFAULT_MODEL_CONFIG,
      ...parsed
    }
  }

  async updateConfig(patch: Partial<ModelConfig>): Promise<ModelConfig> {
    const current = await this.getConfig()

    const updated: ModelConfig = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    }

    const filePath = this.getConfigFilePath()
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(updated, null, 2), 'utf-8')

    return updated
  }

  /**
   * 从指定提供商的 API 同步模型列表
   */
  async syncModels(providerId: string): Promise<RemoteModelGroups> {
    const config = await this.getConfig()
    const provider = config.providers.find((p) => p.id === providerId)

    if (!provider) {
      throw new Error(`Provider ${providerId} not found`)
    }

    if (!provider.baseUrl || !provider.apiKey) {
      throw new Error('Provider baseUrl or apiKey is missing')
    }

    // 构建完整的 API URL
    const baseUrl = provider.baseUrl.trim().replace(/\/$/, '') // 移除末尾的斜杠
    const modelsUrl = `${baseUrl}/v1/models`

    // 发送请求
    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Failed to fetch models: ${response.status} ${response.statusText}. ${errorText}`
      )
    }

    const data = await response.json()

    // OpenAI API 返回格式: { data: [{ id, object, created, owned_by }, ...] }
    const models: RemoteModelInfo[] = data.data || []

    // 按分组组织模型
    return this.groupModels(models)
  }

  /**
   * 根据模型 ID 推断分组并组织模型列表
   */
  private groupModels(models: RemoteModelInfo[]): RemoteModelGroups {
    const groups: RemoteModelGroups = {}

    for (const model of models) {
      const groupName = this.inferGroupFromModelId(model.id)
      if (!groups[groupName]) {
        groups[groupName] = []
      }
      groups[groupName].push(model)
    }

    // 按组名排序
    const sortedGroups: RemoteModelGroups = {}
    Object.keys(groups)
      .sort()
      .forEach((key) => {
        sortedGroups[key] = groups[key]
      })

    return sortedGroups
  }

  /**
   * 从模型 ID 推断分组名称
   * 规则：
   * 1. 有 "/"："/" 前面就是组名
   * 2. 无 "/"：去掉类似 "[aws]" 前缀后再做 "-" 规则，取第二个 "-" 前的部分
   * 3. 都不符合就放进默认组
   */
  private inferGroupFromModelId(modelId: string): string {
    const DEFAULT = 'default'

    if (!modelId) return DEFAULT

    // 1) 有 "/"："/" 前面就是组名
    const slashIndex = modelId.indexOf('/')
    if (slashIndex > 0) {
      return modelId.slice(0, slashIndex)
    }

    // 2) 无 "/"：去掉类似 "[aws]" 前缀后再做 "-" 规则
    const normalized = modelId.replace(/^\[[^\]]+\]/, '') // 删除最前面的 [xxx]

    // 3) 正则/分段：取 "第二个 '-' 前的部分"，也就是前两段拼起来
    //    gemini-3-pro => ["gemini","3","pro"] => "gemini-3"
    const parts = normalized.split('-')
    if (parts.length >= 3 && parts[0] && parts[1]) {
      return `${parts[0]}-${parts[1]}`
    }

    // 4) 其他都进默认组
    return DEFAULT
  }
}

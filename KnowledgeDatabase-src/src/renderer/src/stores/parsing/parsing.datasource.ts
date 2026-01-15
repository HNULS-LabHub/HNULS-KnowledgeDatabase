import type { FileParsingState, ParsingVersion, StartParsingOptions } from './parsing.types'

function toVersion(v: {
  id: string
  state: string
  createdAt: string
  updatedAt: string
}): ParsingVersion {
  const name =
    v.state === 'done'
      ? 'MinerU 解析完成'
      : v.state === 'failed'
        ? 'MinerU 解析失败'
        : 'MinerU 解析中'

  return {
    id: v.id,
    name,
    timestamp: v.updatedAt || v.createdAt,
    status: 'active'
  }
}

export const ParsingDataSource = {
  async getFileParsingState(
    fileKey: string,
    options?: { knowledgeBaseId?: number }
  ): Promise<FileParsingState> {
    // 需要 kbId 才能获取完整版本列表
    if (!options?.knowledgeBaseId) {
      const res = await window.api.minerU.getStatus(fileKey)
      if (!res.success || !res.data) {
        return { fileKey, activeVersionId: null, versions: [] }
      }
      return {
        fileKey,
        activeVersionId: res.data.versionId,
        versions: [
          {
            id: res.data.versionId,
            name:
              res.data.state === 'done'
                ? 'MinerU 解析完成'
                : res.data.state === 'failed'
                  ? 'MinerU 解析失败'
                  : 'MinerU 解析中',
            timestamp: res.data.updatedAt,
            status: 'active'
          }
        ],
        progress: res.data.progress
      }
    }

    const res = await window.api.minerU.getFileParsingState({
      knowledgeBaseId: options.knowledgeBaseId,
      fileRelativePath: fileKey
    })

    if (!res.success || !res.data) {
      return { fileKey, activeVersionId: null, versions: [] }
    }

    const activeId = res.data.activeVersionId

    return {
      fileKey,
      activeVersionId: activeId,
      versions: (res.data.versions || []).map((v) => ({
        ...toVersion(v),
        status: v.id === activeId ? 'active' : 'archived'
      })),
      progress: res.data.progress
    }
  },

  async startParsing(fileKey: string, options: StartParsingOptions): Promise<FileParsingState> {
    const res = await window.api.minerU.startParsing({
      knowledgeBaseId: options.knowledgeBaseId,
      fileRelativePath: fileKey,
      modelVersion: 'vlm'
    })

    if (!res.success || !res.data) {
      throw new Error(res.error || 'Failed to start MinerU parsing')
    }

    // 启动后直接拉完整 state（包含所有版本 + activeVersion）
    return await this.getFileParsingState(fileKey, { knowledgeBaseId: options.knowledgeBaseId })
  }
}

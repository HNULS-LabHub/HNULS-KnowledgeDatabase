import type { FileParsingState, ParsingStage, ParsingVersion, StageStatus } from './parsing.types'

const createStage = (
  stage: ParsingStage,
  status: StageStatus,
  progress: number,
  details?: string,
  error?: string
) => ({ stage, status, progress, details, error })

const createVersion = (partial: Partial<ParsingVersion> & Pick<ParsingVersion, 'id' | 'createdAt' | 'parserName' | 'status'>): ParsingVersion => {
  const base = {
    parsing: createStage('parsing', 'pending', 0),
    chunking: createStage('chunking', 'pending', 0),
    embedding: createStage('embedding', 'pending', 0),
    'kg-indexing': createStage('kg-indexing', 'pending', 0)
  }

  return {
    ...partial,
    stages: {
      ...base,
      ...(partial.stages ?? {})
    }
  }
}

export const mockParsingStateByFileKey = (fileKey: string): FileParsingState => {
  const lower = fileKey.toLowerCase()
  const ext = lower.includes('.') ? lower.split('.').pop() ?? '' : ''

  // 纯文本类：跳过“文档解析”阶段（按需求：其他类型纯文本可跳过）
  const skipDocParsing = ['txt', 'md', 'json', 'csv', 'log'].includes(ext)

  // 预置几个状态场景
  const versions: ParsingVersion[] = [
    createVersion({
      id: 'v3',
      createdAt: Date.now() - 5 * 60 * 1000,
      parserName: 'Parser-Beta',
      status: 'running',
      stages: {
        parsing: skipDocParsing
          ? createStage('parsing', 'skipped', 100, '纯文本：跳过文档解析')
          : createStage('parsing', 'completed', 100, '解析完成'),
        chunking: createStage('chunking', 'running', 45, '分块中…'),
        embedding: createStage('embedding', 'pending', 0),
        'kg-indexing': createStage('kg-indexing', 'pending', 0)
      },
      summary: {
        chunkCount: 0,
        tokenCount: 0,
        parseTimeMs: 0,
        embeddingModel: 'text-embedding-3-small'
      }
    }),
    createVersion({
      id: 'v2',
      createdAt: Date.now() - 2 * 60 * 60 * 1000,
      parserName: 'Parser-Stable',
      status: 'completed',
      stages: {
        parsing: skipDocParsing
          ? createStage('parsing', 'skipped', 100, '纯文本：跳过文档解析')
          : createStage('parsing', 'completed', 100, 'PDF/OCR 解析完成'),
        chunking: createStage('chunking', 'completed', 100, '分块完成'),
        embedding: createStage('embedding', 'completed', 100, '嵌入完成'),
        'kg-indexing': createStage('kg-indexing', 'completed', 100, '已加入知识图谱')
      },
      summary: {
        chunkCount: 128,
        tokenCount: 12500,
        parseTimeMs: 2300,
        embeddingModel: 'text-embedding-3-small'
      }
    }),
    createVersion({
      id: 'v1',
      createdAt: Date.now() - 24 * 60 * 60 * 1000,
      parserName: 'Parser-Legacy',
      status: 'failed',
      stages: {
        parsing: skipDocParsing
          ? createStage('parsing', 'skipped', 100, '纯文本：跳过文档解析')
          : createStage('parsing', 'failed', 30, '解析失败', '不支持的加密 PDF'),
        chunking: createStage('chunking', 'pending', 0),
        embedding: createStage('embedding', 'pending', 0),
        'kg-indexing': createStage('kg-indexing', 'pending', 0)
      }
    })
  ]

  return {
    fileKey,
    activeVersionId: versions[0]?.id ?? null,
    versions
  }
}

export const mockStartNewVersion = (state: FileParsingState, parserName: string): FileParsingState => {
  const newVersion = createVersion({
    id: `v${state.versions.length + 1}-${Date.now()}`,
    createdAt: Date.now(),
    parserName,
    status: 'running',
    stages: {
      parsing: createStage('parsing', 'running', 10, '准备解析…'),
      chunking: createStage('chunking', 'pending', 0),
      embedding: createStage('embedding', 'pending', 0),
      'kg-indexing': createStage('kg-indexing', 'pending', 0)
    }
  })

  return {
    ...state,
    activeVersionId: newVersion.id,
    versions: [newVersion, ...state.versions]
  }
}

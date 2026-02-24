/**
 * @file 关键词提取模块
 * @description 从用户查询中提取高层级关键词（用于 global/relation 检索）
 *              和低层级关键词（用于 local/entity 检索）
 *              支持 LLM 模式和手动模式
 */

import type { KGModelProviderConfig } from '@shared/knowledge-graph-ipc.types'
import type { ExtractedKeywords } from './types'

// ============================================================================
// 日志
// ============================================================================

const log = (msg: string, data?: any): void => {
  if (data) {
    console.log(`[KG-KeywordExtractor] ${msg}`, data)
  } else {
    console.log(`[KG-KeywordExtractor] ${msg}`)
  }
}

const logError = (msg: string, error?: any): void => {
  console.error(`[KG-KeywordExtractor] ${msg}`, error)
}

// ============================================================================
// 常量
// ============================================================================

const DEFAULT_TEMPERATURE = 0.0
const DEFAULT_TIMEOUT_MS = 30_000

// ============================================================================
// LLM 响应类型
// ============================================================================

interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenAIChatResponse {
  choices?: Array<{
    message?: { content?: string }
    text?: string
    finish_reason?: string
  }>
  error?: {
    message?: string
    type?: string
    code?: string | number
  }
}

// ============================================================================
// Prompt 模板
// ============================================================================

const KEYWORD_EXTRACTION_PROMPT = `You are a helpful assistant that extracts keywords from a user query for knowledge graph retrieval.

Given the following query, extract two types of keywords:
1. **high_level_keywords**: Abstract themes, concepts, or topics that represent the broad meaning of the query. These are used for relation-level retrieval in the knowledge graph.
2. **low_level_keywords**: Specific entities, terms, names, or concrete concepts mentioned in the query. These are used for entity-level retrieval in the knowledge graph.

Return your response as a valid JSON object with this exact format:
{
  "high_level_keywords": ["keyword1", "keyword2", ...],
  "low_level_keywords": ["keyword1", "keyword2", ...]
}

Rules:
- Each list should contain 1-5 keywords
- Keywords should be concise (1-3 words each)
- high_level_keywords should capture the abstract intent or theme
- low_level_keywords should capture specific entities or terms
- Return ONLY the JSON object, no other text
`

// ============================================================================
// KeywordExtractor
// ============================================================================

export class KeywordExtractor {
  private providers: Map<string, KGModelProviderConfig>

  constructor(providers: Map<string, KGModelProviderConfig>) {
    this.providers = providers
  }

  /**
   * 更新 providers
   */
  updateProviders(providers: Map<string, KGModelProviderConfig>): void {
    this.providers = providers
  }

  // ==========================================================================
  // 主入口
  // ==========================================================================

  /**
   * 提取关键词
   * - useLLM=true：调用 LLM 进行智能提取
   * - useLLM=false：使用手动传入的关键词
   */
  async extract(params: {
    query: string
    useLLM: boolean
    llmProviderId?: string
    llmModelId?: string
    manualHighLevel?: string[]
    manualLowLevel?: string[]
  }): Promise<ExtractedKeywords> {
    const { query, useLLM } = params

    if (!useLLM) {
      // 手动模式：直接使用传入的关键词
      const result: ExtractedKeywords = {
        highLevel: params.manualHighLevel ?? [],
        lowLevel: params.manualLowLevel ?? []
      }

      // 如果手动关键词为空，使用查询文本本身作为 fallback
      if (result.highLevel.length === 0 && result.lowLevel.length === 0) {
        result.lowLevel = [query]
      }

      log('Manual keywords', result)
      return result
    }

    // LLM 模式
    return this.extractWithLLM(params)
  }

  // ==========================================================================
  // LLM 提取
  // ==========================================================================

  private async extractWithLLM(params: {
    query: string
    llmProviderId?: string
    llmModelId?: string
  }): Promise<ExtractedKeywords> {
    const { query, llmProviderId, llmModelId } = params

    if (!llmProviderId || !llmModelId) {
      throw new Error('LLM keyword extraction requires llmProviderId and llmModelId')
    }

    // 解析 provider
    const provider = this.providers.get(llmProviderId)
    if (!provider || !provider.enabled) {
      throw new Error(`LLM provider not found or disabled: ${llmProviderId}`)
    }
    if (!provider.baseUrl || !provider.apiKey) {
      throw new Error(`LLM provider missing credentials: ${llmProviderId}`)
    }

    // 构建消息
    const messages: OpenAIChatMessage[] = [
      { role: 'system', content: KEYWORD_EXTRACTION_PROMPT },
      { role: 'user', content: query }
    ]

    log('Calling LLM for keyword extraction', {
      provider: llmProviderId,
      model: llmModelId,
      queryLength: query.length
    })

    try {
      const rawResponse = await this.callOpenAIChat({
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model: llmModelId,
        messages,
        temperature: DEFAULT_TEMPERATURE,
        timeoutMs: DEFAULT_TIMEOUT_MS
      })

      const parsed = this.parseKeywordResponse(rawResponse)
      log('LLM keywords extracted', parsed)
      return parsed
    } catch (error) {
      logError('LLM keyword extraction failed, falling back to query text', error)
      // 降级：使用查询文本本身作为关键词
      return {
        highLevel: [query],
        lowLevel: [query]
      }
    }
  }

  // ==========================================================================
  // LLM 调用（与 task-scheduler.ts 中的 callOpenAIChat 一致）
  // ==========================================================================

  private async callOpenAIChat(params: {
    baseUrl: string
    apiKey: string
    model: string
    messages: OpenAIChatMessage[]
    temperature?: number
    timeoutMs?: number
  }): Promise<string> {
    const { baseUrl, apiKey, model, messages } = params
    const temperature = params.temperature ?? DEFAULT_TEMPERATURE
    const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS

    const url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`
    const body = {
      model,
      messages,
      temperature
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })

      let data: OpenAIChatResponse | null = null
      try {
        data = (await response.json()) as OpenAIChatResponse
      } catch {
        data = null
      }

      if (!response.ok) {
        const errorMessage =
          data?.error?.message ??
          (data ? JSON.stringify(data) : '') ??
          `HTTP ${response.status} ${response.statusText}`
        throw new Error(errorMessage)
      }

      const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? ''

      if (!content) {
        throw new Error('Empty LLM response')
      }

      return content
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('LLM request timeout')
      }
      throw err
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // ==========================================================================
  // 响应解析
  // ==========================================================================

  /**
   * 解析 LLM 返回的 JSON 关键词
   */
  private parseKeywordResponse(raw: string): ExtractedKeywords {
    // 尝试提取 JSON 块
    let jsonStr = raw.trim()

    // 移除 markdown 代码块标记
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }

    try {
      const parsed = JSON.parse(jsonStr)

      const highLevel = Array.isArray(parsed.high_level_keywords)
        ? parsed.high_level_keywords.filter((k: any) => typeof k === 'string' && k.trim())
        : []

      const lowLevel = Array.isArray(parsed.low_level_keywords)
        ? parsed.low_level_keywords.filter((k: any) => typeof k === 'string' && k.trim())
        : []

      return { highLevel, lowLevel }
    } catch (error) {
      logError('Failed to parse keyword JSON, attempting regex fallback', error)

      // Regex fallback：尝试提取引号内的关键词
      return this.regexFallbackParse(raw)
    }
  }

  /**
   * 正则降级解析
   */
  private regexFallbackParse(raw: string): ExtractedKeywords {
    const highLevelMatch = raw.match(/"high_level_keywords"\s*:\s*\[(.*?)\]/s)
    const lowLevelMatch = raw.match(/"low_level_keywords"\s*:\s*\[(.*?)\]/s)

    const extractQuoted = (match: RegExpMatchArray | null): string[] => {
      if (!match) return []
      const content = match[1]
      const keywords: string[] = []
      const regex = /"([^"]+)"/g
      let m: RegExpExecArray | null
      while ((m = regex.exec(content)) !== null) {
        keywords.push(m[1])
      }
      return keywords
    }

    return {
      highLevel: extractQuoted(highLevelMatch),
      lowLevel: extractQuoted(lowLevelMatch)
    }
  }
}

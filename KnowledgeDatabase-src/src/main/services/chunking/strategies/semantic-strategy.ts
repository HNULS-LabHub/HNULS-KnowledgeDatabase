/**
 * 语义分块策略实现（Semantic）
 *
 * 目标：
 * - 优先按段落边界分割；段落过长时降级到行/句子边界；极端情况下硬切
 * - 最终按 maxChars 合并成 chunk，并基于 overlapChars 做滑动窗口重叠
 */

import type { ChunkingConfig, Chunk } from '../types'
import { IChunkingStrategy } from './base-strategy'

const MIN_MAX_CHARS = 100
const MAX_MAX_CHARS = 10000

export class SemanticChunkingStrategy implements IChunkingStrategy {
  readonly name = 'semantic'
  readonly description = '语义分块模式：优先段落，其次句子；支持重叠分块（overlap）'

  validateConfig(config: ChunkingConfig): boolean {
    if (config.mode !== 'semantic') return false

    const maxChars = config.maxChars
    const overlapChars = config.overlapChars

    if (!Number.isFinite(maxChars) || maxChars < MIN_MAX_CHARS || maxChars > MAX_MAX_CHARS) {
      return false
    }

    if (!Number.isFinite(overlapChars) || overlapChars < 0 || overlapChars >= maxChars) {
      return false
    }

    return true
  }

  async chunk(content: string, config: ChunkingConfig): Promise<Chunk[]> {
    if (!this.validateConfig(config)) {
      throw new Error(`Invalid config for semantic strategy: ${JSON.stringify(config)}`)
    }

    if (config.mode !== 'semantic') {
      throw new Error('Semantic strategy requires mode=semantic')
    }

    const maxChars = config.maxChars
    const overlapChars = config.overlapChars

    const normalized = this.normalizeNewlines(content)
    const atomicSegments = this.createAtomicSegments(normalized, maxChars)
    const chunkTexts = this.mergeWithOverlap(atomicSegments, maxChars, overlapChars)

    return chunkTexts
      .map((text, index) => this.createChunk(index, text))
      .filter((c) => c.content.length > 0)
  }

  private normalizeNewlines(input: string): string {
    return input.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  }

  /**
   * 生成“原子片段”：尽量保持段落/句子完整；保证每个片段长度 <= maxChars
   */
  private createAtomicSegments(text: string, maxChars: number): string[] {
    const trimmed = text.trim()
    if (trimmed.length === 0) return []

    // 段落：空行分隔（\n\n 或 \n\s*\n+）
    const paragraphs = trimmed.split(/\n\s*\n+/).filter((p) => p.trim().length > 0)

    const atomic: string[] = []

    paragraphs.forEach((rawParagraph, paragraphIndex) => {
      const paragraph = rawParagraph.trim()

      // 段落间保留空行（作为前缀，方便拼接还原结构）
      const paragraphPrefix = paragraphIndex === 0 ? '' : '\n\n'

      const paragraphSegments = this.splitParagraph(paragraph, maxChars)

      if (paragraphSegments.length > 0) {
        paragraphSegments[0] = paragraphPrefix + paragraphSegments[0]
      } else {
        paragraphSegments.push(paragraphPrefix + paragraph)
      }

      for (const seg of paragraphSegments) {
        if (seg.length <= maxChars) {
          atomic.push(seg)
        } else {
          // 兜底：硬切
          atomic.push(...this.hardSplit(seg, maxChars))
        }
      }
    })

    return atomic.filter((s) => s.trim().length > 0)
  }

  /**
   * 段落内拆分：先按行，再按句子，最后硬切
   * 注意：保留换行符为前缀，以便最终拼接还原结构
   */
  private splitParagraph(paragraph: string, maxChars: number): string[] {
    if (paragraph.length <= maxChars) return [paragraph]

    const lines = paragraph.split('\n')
    const segments: string[] = []

    lines.forEach((rawLine, lineIndex) => {
      const line = rawLine
      const linePrefix = lineIndex === 0 ? '' : '\n'

      // 空行：仅保留前缀（用于结构占位）
      if (line.length === 0) {
        segments.push(linePrefix)
        return
      }

      if ((linePrefix + line).length <= maxChars) {
        segments.push(linePrefix + line)
        return
      }

      const sentenceSegments = this.splitBySentences(line, maxChars)
      if (sentenceSegments.length > 0) {
        sentenceSegments[0] = linePrefix + sentenceSegments[0]
        segments.push(...sentenceSegments)
      } else {
        segments.push(linePrefix + line)
      }
    })

    return segments
  }

  /**
   * 句子切分：保留句末标点；极端情况下返回硬切片段
   */
  private splitBySentences(text: string, maxChars: number): string[] {
    const matches = text.match(/[^。！？.!?]+[。！？.!?]+|[^。！？.!?]+$/g) ?? []
    const sentences = matches.filter((s) => s.length > 0)

    const out: string[] = []
    for (const s of sentences) {
      if (s.length <= maxChars) {
        out.push(s)
      } else {
        out.push(...this.hardSplit(s, maxChars))
      }
    }

    return out
  }

  private hardSplit(text: string, maxChars: number): string[] {
    if (maxChars <= 0) return [text]

    const res: string[] = []
    for (let i = 0; i < text.length; i += maxChars) {
      res.push(text.slice(i, i + maxChars))
    }
    return res
  }

  /**
   * 合并 atomic segments 为 chunks，并做 overlap（按原子片段回退）
   */
  private mergeWithOverlap(segments: string[], maxChars: number, overlapChars: number): string[] {
    if (segments.length === 0) return []

    const chunks: string[] = []
    let buffer: string[] = []
    let bufferLen = 0

    for (const seg of segments) {
      const segLen = seg.length

      // buffer 为空且 seg 本身已达上限：直接输出
      if (buffer.length === 0 && segLen >= maxChars) {
        chunks.push(seg)
        buffer = []
        bufferLen = 0
        continue
      }

      if (bufferLen + segLen > maxChars && buffer.length > 0) {
        chunks.push(buffer.join(''))

        // overlap 不能导致新块超过 maxChars
        const allowedOverlap = Math.min(overlapChars, Math.max(0, maxChars - segLen))

        const overlapBuffer: string[] = []
        let overlapLen = 0

        if (allowedOverlap > 0) {
          for (let i = buffer.length - 1; i >= 0; i--) {
            const s = buffer[i]
            const nextLen = overlapLen + s.length
            if (nextLen > allowedOverlap) break
            overlapBuffer.unshift(s)
            overlapLen = nextLen
          }
        }

        buffer = [...overlapBuffer, seg]
        bufferLen = overlapLen + segLen
      } else {
        buffer.push(seg)
        bufferLen += segLen
      }
    }

    if (buffer.length > 0) {
      chunks.push(buffer.join(''))
    }

    return chunks
      .map((c) => c.trim())
      .filter((c) => c.length > 0)
  }

  private createChunk(index: number, content: string): Chunk {
    const trimmed = content.trim()
    return {
      id: `chunk-${index}`,
      index,
      content: trimmed,
      size: trimmed.length,
      metadata: {
        mode: 'semantic'
      }
    }
  }
}

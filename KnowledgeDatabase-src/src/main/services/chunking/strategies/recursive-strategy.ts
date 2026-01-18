/**
 * 段落分块策略实现
 *
 * 算法逻辑：
 * 1. 按照 maxChars 尽量凑满
 * 2. 优先在段尾结束
 * 3. 其次在句尾结束
 */
import type { ChunkingConfig, Chunk } from '../types'
import { IChunkingStrategy } from './base-strategy'

export class RecursiveChunkingStrategy implements IChunkingStrategy {
  readonly name = 'recursive'
  readonly description =
    '段落分块模式：按照设置的单个分段最大字符数来尽量凑满，结束时优先结束在段尾，其次是句尾'

  validateConfig(config: ChunkingConfig): boolean {
    return config.mode === 'recursive' && config.maxChars >= 100 && config.maxChars <= 10000
  }

  async chunk(content: string, config: ChunkingConfig): Promise<Chunk[]> {
    if (!this.validateConfig(config)) {
      throw new Error(`Invalid config for recursive strategy: ${JSON.stringify(config)}`)
    }

    const chunks: Chunk[] = []
    const maxChars = config.maxChars

    // 按段落分割（支持多种换行符）
    const paragraphs = content.split(/\n\s*\n|\r\n\r\n|\r\r/).filter((p) => p.trim().length > 0)

    let currentContent = ''
    let currentStartChar = 0
    let chunkIndex = 0
    let paragraphIndex = 0

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim()
      const paragraphWithNewline = paragraphIndex > 0 ? '\n\n' + trimmedParagraph : trimmedParagraph

      // 检查是否可以添加到当前块
      const wouldExceed = (currentContent + paragraphWithNewline).length > maxChars

      if (wouldExceed && currentContent.length > 0) {
        // 当前块已满，需要结束
        // 尝试在句尾结束
        const sentenceEnded = this.tryEndAtSentence(currentContent, maxChars)

        if (sentenceEnded) {
          // 成功在句尾结束
          const chunk = this.createChunk(
            chunkIndex++,
            currentContent,
            currentStartChar,
            currentStartChar + currentContent.length - 1,
            paragraphIndex - 1
          )
          chunks.push(chunk)

          // 开始新块
          currentStartChar = currentStartChar + currentContent.length
          currentContent = paragraphWithNewline
        } else {
          // 无法在句尾结束，直接在段尾结束
          const chunk = this.createChunk(
            chunkIndex++,
            currentContent,
            currentStartChar,
            currentStartChar + currentContent.length - 1,
            paragraphIndex - 1
          )
          chunks.push(chunk)

          // 开始新块
          currentStartChar = currentStartChar + currentContent.length
          currentContent = paragraphWithNewline
        }
      } else {
        // 可以添加到当前块
        if (currentContent.length === 0) {
          currentContent = trimmedParagraph
        } else {
          currentContent += '\n\n' + trimmedParagraph
        }
      }

      paragraphIndex++
    }

    // 处理最后一个块
    if (currentContent.length > 0) {
      // 如果最后一个块超过限制，尝试在句尾结束
      if (currentContent.length > maxChars) {
        const sentenceEnded = this.tryEndAtSentence(currentContent, maxChars)
        if (sentenceEnded) {
          const chunk = this.createChunk(
            chunkIndex++,
            currentContent,
            currentStartChar,
            currentStartChar + currentContent.length - 1,
            paragraphIndex - 1
          )
          chunks.push(chunk)
        } else {
          // 无法在句尾结束，直接截断
          const truncated = currentContent.substring(0, maxChars)
          const chunk = this.createChunk(
            chunkIndex++,
            truncated,
            currentStartChar,
            currentStartChar + truncated.length - 1,
            paragraphIndex - 1
          )
          chunks.push(chunk)
        }
      } else {
        const chunk = this.createChunk(
          chunkIndex++,
          currentContent,
          currentStartChar,
          currentStartChar + currentContent.length - 1,
          paragraphIndex - 1
        )
        chunks.push(chunk)
      }
    }

    return chunks
  }

  /**
   * 尝试在句尾结束（如果可能）
   * @param content 当前内容
   * @param maxChars 最大字符数
   * @returns 是否成功在句尾结束
   */
  private tryEndAtSentence(content: string, maxChars: number): boolean {
    if (content.length <= maxChars) return false

    // 查找最后一个句子结束符（。！？. ! ?）
    const sentenceEndRegex = /[。！？.!\?]\s*/g
    let lastMatch: RegExpExecArray | null = null
    let match: RegExpExecArray | null

    while ((match = sentenceEndRegex.exec(content)) !== null) {
      if (match.index + match[0].length <= maxChars) {
        lastMatch = match
      } else {
        break
      }
    }

    if (lastMatch) {
      // 截断到句尾
      const endPos = lastMatch.index + lastMatch[0].length
      content = content.substring(0, endPos)
      return true
    }

    return false
  }

  /**
   * 创建分块对象
   */
  private createChunk(
    index: number,
    content: string,
    startChar: number,
    endChar: number,
    paragraphIndex: number
  ): Chunk {
    return {
      id: `chunk-${index}`,
      index,
      content: content.trim(),
      size: content.trim().length,
      startChar,
      endChar,
      metadata: {
        paragraphIndex
      }
    }
  }
}

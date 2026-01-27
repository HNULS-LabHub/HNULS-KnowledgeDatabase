/**
 * 段落分块策略实现
 *
 * 算法逻辑：
 * 1. 按照 maxChars 尽量凑满
 * 2. 优先在段尾结束
 * 3. 其次在句尾结束
 * 4. 对于超长段落（无空行分隔），按行或强制截断
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

      // 如果单个段落超过maxChars，需要拆分该段落
      if (trimmedParagraph.length > maxChars) {
        // 先保存当前已有的内容
        if (currentContent.length > 0) {
          const chunk = this.createChunk(
            chunkIndex++,
            currentContent,
            currentStartChar,
            currentStartChar + currentContent.length - 1,
            paragraphIndex - 1
          )
          chunks.push(chunk)
          currentStartChar = currentStartChar + currentContent.length
          currentContent = ''
        }

        // 拆分超长段落
        const subChunks = this.splitLongParagraph(trimmedParagraph, maxChars)
        for (const subContent of subChunks) {
          const chunk = this.createChunk(
            chunkIndex++,
            subContent,
            currentStartChar,
            currentStartChar + subContent.length - 1,
            paragraphIndex
          )
          chunks.push(chunk)
          currentStartChar = currentStartChar + subContent.length
        }

        paragraphIndex++
        continue
      }

      const paragraphWithNewline = paragraphIndex > 0 ? '\n\n' + trimmedParagraph : trimmedParagraph

      // 检查是否可以添加到当前块
      const wouldExceed = (currentContent + paragraphWithNewline).length > maxChars

      if (wouldExceed && currentContent.length > 0) {
        // 当前块已满，保存并开始新块
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
        currentContent = trimmedParagraph
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
      const chunk = this.createChunk(
        chunkIndex++,
        currentContent,
        currentStartChar,
        currentStartChar + currentContent.length - 1,
        paragraphIndex - 1
      )
      chunks.push(chunk)
    }

    return chunks
  }

  /**
   * 拆分超长段落
   * 优先按行分割，其次按句子分割，最后强制按字符截断
   */
  private splitLongParagraph(paragraph: string, maxChars: number): string[] {
    const results: string[] = []

    // 先尝试按行分割
    const lines = paragraph.split(/\n/).filter((l) => l.length > 0)

    if (lines.length > 1) {
      // 有多行，按行合并
      let currentChunk = ''
      for (const line of lines) {
        if (line.length > maxChars) {
          // 单行也超长，保存当前内容后拆分该行
          if (currentChunk.length > 0) {
            results.push(currentChunk.trim())
            currentChunk = ''
          }
          const splitLines = this.splitLongLine(line, maxChars)
          results.push(...splitLines)
        } else if ((currentChunk + '\n' + line).length > maxChars) {
          // 加上这行会超限，保存当前内容
          if (currentChunk.length > 0) {
            results.push(currentChunk.trim())
          }
          currentChunk = line
        } else {
          // 可以合并
          currentChunk = currentChunk.length > 0 ? currentChunk + '\n' + line : line
        }
      }
      if (currentChunk.length > 0) {
        results.push(currentChunk.trim())
      }
    } else {
      // 只有单行，按句子或强制截断
      const splitLines = this.splitLongLine(paragraph, maxChars)
      results.push(...splitLines)
    }

    return results
  }

  /**
   * 拆分超长单行
   * 优先按句子分割，最后强制按字符截断
   */
  private splitLongLine(line: string, maxChars: number): string[] {
    const results: string[] = []
    let remaining = line

    while (remaining.length > maxChars) {
      // 尝试在句尾截断
      const cutPoint = this.findBestCutPoint(remaining, maxChars)
      const chunk = remaining.substring(0, cutPoint).trim()
      if (chunk.length > 0) {
        results.push(chunk)
      }
      remaining = remaining.substring(cutPoint).trim()
    }

    if (remaining.length > 0) {
      results.push(remaining)
    }

    return results
  }

  /**
   * 找到最佳截断点
   * 优先级：句子结束符 > 逗号/分号 > 空格 > 强制截断
   */
  private findBestCutPoint(content: string, maxChars: number): number {
    const searchRange = content.substring(0, maxChars)

    // 优先找句子结束符（。！？. ! ?）
    const sentenceEndRegex = /[。！？.!?]/g
    let lastSentenceEnd = -1
    let match: RegExpExecArray | null
    while ((match = sentenceEndRegex.exec(searchRange)) !== null) {
      lastSentenceEnd = match.index + 1
    }
    if (lastSentenceEnd > maxChars * 0.3) {
      return lastSentenceEnd
    }

    // 其次找逗号、分号、冒号
    const punctuationRegex = /[，,；;：:]/g
    let lastPunctuation = -1
    while ((match = punctuationRegex.exec(searchRange)) !== null) {
      lastPunctuation = match.index + 1
    }
    if (lastPunctuation > maxChars * 0.3) {
      return lastPunctuation
    }

    // 再找空格或换行
    const spaceRegex = /[\s]/g
    let lastSpace = -1
    while ((match = spaceRegex.exec(searchRange)) !== null) {
      lastSpace = match.index + 1
    }
    if (lastSpace > maxChars * 0.5) {
      return lastSpace
    }

    // 强制截断
    return maxChars
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

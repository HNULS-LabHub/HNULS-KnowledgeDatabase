import type { FileChunkingState, ChunkingConfig, Chunk } from './chunking.types'

/**
 * 生成模拟分块数据
 */
export const mockChunkingState = (fileKey: string, config: ChunkingConfig): FileChunkingState => {
  // 模拟文档内容（多段落）
  const mockParagraphs = [
    '这是第一个段落的示例内容。它展示了如何根据配置的分块模式将文档分割成更小的片段。分块的质量直接影响后续的检索和嵌入效果。在实际应用中，系统会尽量保持语义的完整性，避免在句子或段落中间截断。',
    '第二个段落包含了更多的上下文信息。在段落分块模式下，系统会优先按照文档的自然结构（如段落、章节）进行分割，然后再进行细粒度的分块。这种方式能够更好地保持文档的语义连贯性。',
    '第三个段落展示了分块策略的重要性。通过合理的分块配置，可以确保重要的上下文信息不会丢失，同时保持分块之间的一定连续性。这对于后续的向量检索和知识图谱构建都非常关键。',
    '第四个段落说明了分块大小的影响。如果分块过小，可能会导致上下文丢失；如果分块过大，可能会影响检索的精确度。因此，需要根据实际应用场景来调整最大字符数的配置。',
    '最后一个段落总结了分块配置的最佳实践。建议的范围通常在 500-2000 字符之间，这样可以平衡语义完整性和检索效果。同时，段落分块模式能够更好地适应不同类型的文档结构。'
  ]

  const chunks: Chunk[] = []
  let currentChunk = ''
  let chunkIndex = 0
  let chunkId = 1

  // 根据 maxChars 配置进行分块
  for (const paragraph of mockParagraphs) {
    // 如果当前段落加上现有内容超过限制，先保存当前块
    if (currentChunk && currentChunk.length + paragraph.length > config.maxChars) {
      chunks.push({
        id: `chunk-${chunkId}`,
        content: currentChunk.trim(),
        size: currentChunk.trim().length,
        index: chunkIndex++
      })
      chunkId++
      currentChunk = ''
    }

    // 如果单个段落就超过限制，需要截断
    if (paragraph.length > config.maxChars) {
      let remaining = paragraph
      while (remaining.length > 0) {
        const chunkContent = remaining.slice(0, config.maxChars)
        chunks.push({
          id: `chunk-${chunkId}`,
          content: chunkContent,
          size: chunkContent.length,
          index: chunkIndex++
        })
        chunkId++
        remaining = remaining.slice(config.maxChars)
      }
    } else {
      // 添加到当前块
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph
    }
  }

  // 保存最后一个块
  if (currentChunk.trim()) {
    chunks.push({
      id: `chunk-${chunkId}`,
      content: currentChunk.trim(),
      size: currentChunk.trim().length,
      index: chunkIndex
    })
  }

  return {
    fileKey,
    config,
    chunks,
    lastUpdated: new Date().toISOString()
  }
}

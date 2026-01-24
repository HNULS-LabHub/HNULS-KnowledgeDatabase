/**
 * 嵌入 Mock 数据生成器
 */

import type { FileEmbeddingState, EmbeddingVector } from './embedding.types'

/**
 * 生成 Mock 向量数据
 */
function generateMockVector(chunkId: string, index: number): EmbeddingVector {
  // 生成随机向量（维度 1536，模拟 OpenAI embedding）
  const vector = Array.from({ length: 1536 }, () => Math.random() * 2 - 1)

  return {
    id: `vec_${chunkId}_${index}`,
    content: `这是第 ${index + 1} 个分块的内容...`,
    vector,
    chunkId
  }
}

/**
 * 模拟获取文件嵌入状态
 */
export async function mockGetFileEmbeddingState(
  fileKey: string,
  configId: string
): Promise<FileEmbeddingState> {
  // 模拟网络延迟
  await new Promise((resolve) => setTimeout(resolve, 300))

  // 随机决定是否有嵌入结果
  const hasEmbeddings = Math.random() > 0.7

  if (!hasEmbeddings) {
    return {
      fileKey,
      config: {
        configId,
        providerId: 'openai',
        modelId: 'text-embedding-3-small',
        dimensions: 1536
      },
      vectors: [],
      status: 'idle'
    }
  }

  // 生成 Mock 向量数据
  const vectorCount = Math.floor(Math.random() * 20) + 5
  const vectors: EmbeddingVector[] = []

  for (let i = 0; i < vectorCount; i++) {
    vectors.push(generateMockVector(`chunk_${i}`, i))
  }

  return {
    fileKey,
    config: {
      configId,
      providerId: 'openai',
      modelId: 'text-embedding-3-small',
      dimensions: 1536
    },
    vectors,
    status: 'completed',
    progress: 100,
    totalVectors: vectorCount,
    processedVectors: vectorCount,
    lastUpdated: new Date().toISOString()
  }
}

/**
 * 模拟执行嵌入操作
 * 返回一个 Promise，模拟异步嵌入过程
 */
export async function mockStartEmbedding(
  fileKey: string,
  configId: string,
  totalChunks: number,
  onProgress?: (progress: number, processed: number) => void
): Promise<FileEmbeddingState> {
  console.log(`[Mock] Starting embedding for ${fileKey} with ${totalChunks} chunks`)

  const vectors: EmbeddingVector[] = []

  // 模拟逐个处理分块
  for (let i = 0; i < totalChunks; i++) {
    // 模拟处理延迟（每个分块 200-500ms）
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 300 + 200))

    // 生成向量
    vectors.push(generateMockVector(`chunk_${i}`, i))

    // 更新进度
    const progress = Math.round(((i + 1) / totalChunks) * 100)
    if (onProgress) {
      onProgress(progress, i + 1)
    }
  }

  return {
    fileKey,
    config: {
      configId,
      providerId: 'openai',
      modelId: 'text-embedding-3-small',
      dimensions: 1536
    },
    vectors,
    status: 'completed',
    progress: 100,
    totalVectors: totalChunks,
    processedVectors: totalChunks,
    lastUpdated: new Date().toISOString()
  }
}

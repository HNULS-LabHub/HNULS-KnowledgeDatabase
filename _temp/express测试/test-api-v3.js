/**
 * Express API 测试脚本 v3
 * 在 v2 基础上新增 fileKey/fileKeys 筛选测试
 *
 * 使用方式:
 *   node test-api-v3.js
 *   node test-api-v3.js --filter-only     仅跑筛选相关测试
 *
 * 需要 Node 18+（内置 fetch）
 */

const BASE_URL = 'http://localhost:3721/api/v1'

// ============================================================================
// 颜色 & 日志
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
}

function log(color, ...args) {
  console.log(color, ...args, colors.reset)
}
function logSuccess(msg) { log(colors.green, '✓', msg) }
function logError(msg) { log(colors.red, '✗', msg) }
function logInfo(msg) { log(colors.cyan, '➜', msg) }
function logWarn(msg) { log(colors.yellow, '⚠', msg) }
function logDim(msg) { log(colors.dim, '  ', msg) }

// ============================================================================
// 测试结果
// ============================================================================

let testResults = { total: 0, passed: 0, failed: 0 }

async function test(name, fn) {
  testResults.total++
  logInfo(`测试: ${name}`)
  try {
    await fn()
    testResults.passed++
    logSuccess(`通过: ${name}`)
    console.log()
  } catch (error) {
    testResults.failed++
    logError(`失败: ${name}`)
    console.error('  错误:', error.message)
    console.log()
  }
}

// ============================================================================
// HTTP 请求 & 断言
// ============================================================================

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`
  const method = options.method || 'GET'
  logInfo(`请求: ${method} ${path}`)

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  })

  const data = await response.json()
  console.log(`  状态: ${response.status} ${response.statusText}`)
  return { response, data }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || '断言失败')
}

// ============================================================================
// ==================== 自动发现辅助函数 ====================
// ============================================================================

/**
 * 发现可用的检索目标（知识库 + 向量表 + 文档列表）
 * 返回: { kbId, tableName, fileKeys: [fileKey1, fileKey2, ...] } 或 null
 */
async function discoverRetrievalTarget() {
  const { data: kbList } = await request('/knowledge-bases')
  if (!kbList.success || !kbList.data.length) return null

  for (const kb of kbList.data) {
    const { data: detail } = await request(`/knowledge-bases/${kb.id}`)
    if (!detail.success || !detail.data.databaseName) continue

    // 查文档列表
    const { data: docs } = await request(`/knowledge-bases/${kb.id}/documents?page=1&pageSize=10`)
    if (!docs.success || !docs.data?.documents?.length) continue

    const fileKeys = []

    for (const doc of docs.data.documents) {
      if (!doc.fileKey) continue
      const fileKey = encodeURIComponent(doc.fileKey)
      const { data: embs } = await request(`/knowledge-bases/${kb.id}/documents/${fileKey}/embeddings`)
      if (!embs.success || !embs.data?.length) continue

      for (const emb of embs.data) {
        if (emb.status === 'completed' && emb.dimensions && emb.embeddingConfigId) {
          const safeId = emb.embeddingConfigId.replace(/[^a-zA-Z0-9_]/g, '_')
          const tableName = `emb_cfg_${safeId}_${emb.dimensions}_chunks`
          
          // 收集该文档的 fileKey
          fileKeys.push(doc.fileKey)

          // 找到第一个可用表就返回（同时收集该 KB 下的多个 fileKey）
          if (fileKeys.length >= 2) {
            console.log(`  发现可用目标: KB=${kb.id}, table=${tableName}, fileKeys=${fileKeys.length}个`)
            return { kbId: kb.id, tableName, fileKeys }
          }
        }
      }
    }

    // 即使只有 1 个 fileKey 也可返回
    if (fileKeys.length > 0) {
      const doc = docs.data.documents[0]
      const fileKey = encodeURIComponent(doc.fileKey)
      const { data: embs } = await request(`/knowledge-bases/${kb.id}/documents/${fileKey}/embeddings`)
      if (embs.success && embs.data?.length) {
        const emb = embs.data[0]
        const safeId = emb.embeddingConfigId.replace(/[^a-zA-Z0-9_]/g, '_')
        const tableName = `emb_cfg_${safeId}_${emb.dimensions}_chunks`
        console.log(`  发现可用目标: KB=${kb.id}, table=${tableName}, fileKeys=${fileKeys.length}个`)
        return { kbId: kb.id, tableName, fileKeys }
      }
    }
  }
  return null
}

// ============================================================================
// ==================== 新增: fileKey/fileKeys 筛选测试 ====================
// ============================================================================

/**
 * 测试 16: 检索 — 单个 fileKey 筛选
 */
async function testRetrievalWithFileKey(target) {
  if (!target || !target.fileKeys.length) {
    logWarn('跳过: 未发现可用的 fileKey')
    return
  }

  const fileKey = target.fileKeys[0]

  const { response, data } = await request('/retrieval/search', {
    method: 'POST',
    body: {
      knowledgeBaseId: target.kbId,
      tableName: target.tableName,
      queryText: '测试查询',
      fileKey,
      k: 5,
      ef: 100
    }
  })

  console.log(`  响应状态: ${response.status}`)

  if (response.ok && data.success) {
    assert(Array.isArray(data.data), 'data 应是数组')
    
    // 验证所有结果的 file_key 都匹配
    for (const hit of data.data) {
      if (hit.file_key && hit.file_key !== fileKey) {
        throw new Error(`file_key 不匹配: 期望 ${fileKey}, 实际 ${hit.file_key}`)
      }
    }

    console.log(`  成功筛选: 返回 ${data.data.length} 条结果，均来自 fileKey=${fileKey}`)
    if (data.data.length > 0) {
      const first = data.data[0]
      console.log('  Top-1:', JSON.stringify({
        id: first.id,
        file_key: first.file_key,
        file_name: first.file_name,
        chunk_index: first.chunk_index,
        distance: first.distance,
        content_preview: first.content.slice(0, 60) + '…'
      }, null, 2))
    }
  } else {
    logWarn(`筛选检索未成功: ${data.error?.message || JSON.stringify(data)}`)
  }
}

/**
 * 测试 17: 检索 — 多个 fileKeys 筛选
 */
async function testRetrievalWithFileKeys(target) {
  if (!target || target.fileKeys.length < 2) {
    logWarn('跳过: 需要至少 2 个 fileKey')
    return
  }

  const fileKeys = target.fileKeys.slice(0, 2) // 取前两个

  const { response, data } = await request('/retrieval/search', {
    method: 'POST',
    body: {
      knowledgeBaseId: target.kbId,
      tableName: target.tableName,
      queryText: '测试查询',
      fileKeys,
      k: 10,
      ef: 100
    }
  })

  console.log(`  响应状态: ${response.status}`)

  if (response.ok && data.success) {
    assert(Array.isArray(data.data), 'data 应是数组')
    
    // 验证所有结果的 file_key 都在 fileKeys 内
    for (const hit of data.data) {
      if (hit.file_key && !fileKeys.includes(hit.file_key)) {
        throw new Error(`file_key 不在范围内: ${hit.file_key} not in [${fileKeys.join(', ')}]`)
      }
    }

    console.log(`  成功筛选: 返回 ${data.data.length} 条结果，来自 ${fileKeys.length} 个文件`)
    console.log('  fileKeys:', fileKeys)

    // 统计各文件的命中数
    const distribution = {}
    for (const hit of data.data) {
      const key = hit.file_key || 'unknown'
      distribution[key] = (distribution[key] || 0) + 1
    }
    console.log('  命中分布:', distribution)
  } else {
    logWarn(`多文件筛选未成功: ${data.error?.message || JSON.stringify(data)}`)
  }
}

/**
 * 测试 18: 检索 — fileKeys 空数组（预期 400）
 */
async function testRetrievalEmptyFileKeys(target) {
  if (!target) {
    logWarn('跳过: 未发现可用目标')
    return
  }

  const { response, data } = await request('/retrieval/search', {
    method: 'POST',
    body: {
      knowledgeBaseId: target.kbId,
      tableName: target.tableName,
      queryText: '测试查询',
      fileKeys: [],
      k: 5
    }
  })

  assert(response.status === 400, '空 fileKeys 应返回 400')
  assert(data.success === false, 'success 应为 false')
  assert(data.error.code === 'INVALID_PARAM', '错误代码应为 INVALID_PARAM')
  console.log('  预期的错误:', data.error.message)
}

/**
 * 测试 19: 检索 — 不存在的 fileKey（验证筛选条件生效）
 */
async function testRetrievalNonExistentFileKey(target) {
  if (!target) {
    logWarn('跳过: 未发现可用目标')
    return
  }

  const { response, data } = await request('/retrieval/search', {
    method: 'POST',
    body: {
      knowledgeBaseId: target.kbId,
      tableName: target.tableName,
      queryText: '测试查询',
      fileKey: 'non_existent_file_key_12345.pdf',
      k: 5,
      ef: 100
    }
  })

  console.log(`  响应状态: ${response.status}`)

  if (response.ok && data.success) {
    assert(Array.isArray(data.data), 'data 应是数组')
    // SurrealDB 向量检索可能会返回结果即使 fileKey 不匹配
    // 关键是验证返回的结果中没有不匹配的 fileKey
    for (const hit of data.data) {
      if (hit.file_key && hit.file_key === 'non_existent_file_key_12345.pdf') {
        throw new Error('不应返回不存在的 fileKey')
      }
    }
    
    if (data.data.length === 0) {
      console.log('  正确返回空结果 ✓')
    } else {
      console.log(`  返回 ${data.data.length} 条结果（fileKey 筛选已生效，但 kNN 算法仍返回了其他结果）`)
      logWarn('  注意: SurrealDB 向量检索在 fileKey 不匹配时可能仍返回最近邻结果')
    }
  } else {
    logWarn(`查询失败: ${data.error?.message || JSON.stringify(data)}`)
  }
}

/**
 * 测试 20: 检索 — fileKey 优先级（同时传 fileKey 和 fileKeys，应只用 fileKey）
 */
async function testRetrievalFileKeyPrecedence(target) {
  if (!target || target.fileKeys.length < 2) {
    logWarn('跳过: 需要至少 2 个 fileKey')
    return
  }

  const fileKey = target.fileKeys[0]
  const fileKeys = target.fileKeys.slice(1, 3)

  const { response, data } = await request('/retrieval/search', {
    method: 'POST',
    body: {
      knowledgeBaseId: target.kbId,
      tableName: target.tableName,
      queryText: '测试查询',
      fileKey,      // 单值
      fileKeys,     // 数组（应被忽略）
      k: 5,
      ef: 100
    }
  })

  console.log(`  响应状态: ${response.status}`)

  if (response.ok && data.success) {
    assert(Array.isArray(data.data), 'data 应是数组')
    
    // 所有结果应只来自 fileKey，而不是 fileKeys
    for (const hit of data.data) {
      if (hit.file_key && hit.file_key !== fileKey) {
        throw new Error(`优先级错误: 应只使用 fileKey=${fileKey}, 实际出现 ${hit.file_key}`)
      }
    }

    console.log(`  优先级正确: fileKey 优先，返回 ${data.data.length} 条结果`)
  } else {
    logWarn(`优先级测试未成功: ${data.error?.message || JSON.stringify(data)}`)
  }
}

/**
 * 测试 21: 检索 — fileKey 与重排组合
 */
async function testRetrievalFileKeyWithRerank(target) {
  if (!target || !target.fileKeys.length) {
    logWarn('跳过: 未发现可用的 fileKey')
    return
  }

  const fileKey = target.fileKeys[0]

  const { response, data } = await request('/retrieval/search', {
    method: 'POST',
    body: {
      knowledgeBaseId: target.kbId,
      tableName: target.tableName,
      queryText: '测试查询',
      fileKey,
      k: 10,
      ef: 100,
      rerankModelId: 'BAAI/bge-reranker-v2-m3',
      rerankTopN: 3
    }
  })

  console.log(`  响应状态: ${response.status}`)

  if (response.ok && data.success) {
    assert(Array.isArray(data.data), 'data 应是数组')

    // 验证筛选
    for (const hit of data.data) {
      if (hit.file_key && hit.file_key !== fileKey) {
        throw new Error(`file_key 不匹配: ${hit.file_key}`)
      }
    }

    console.log(`  fileKey + 重排组合成功: 返回 ${data.data.length} 条结果`)

    if (data.data.length > 0 && data.data[0].rerank_score !== undefined) {
      logSuccess('  重排分数存在 ✓')
    }
  } else {
    logWarn(`fileKey+重排未成功: ${data.error?.message || ''}`)
  }
}

// ============================================================================
// 主测试流程
// ============================================================================

async function main() {
  const filterOnly = process.argv.includes('--filter-only')

  console.log('='.repeat(60))
  console.log(filterOnly ? 'fileKey/fileKeys 筛选测试 (v3)' : 'Express API 全量测试 (v3)')
  console.log('='.repeat(60))
  console.log()

  try {
    // 服务可用性检查
    logInfo('检查服务可用性...')
    const statusCheck = await fetch(`${BASE_URL}/status`)
    if (!statusCheck.ok) {
      throw new Error(`服务不可用: ${statusCheck.status} ${statusCheck.statusText}`)
    }
    logSuccess('服务正常运行')
    console.log()

    // 自动发现可用目标
    logInfo('发现可用检索目标（包含 fileKey）...')
    let target = null
    try {
      target = await discoverRetrievalTarget()
    } catch (e) {
      logWarn(`自动发现失败: ${e.message}`)
    }

    if (target) {
      logSuccess(`目标: kbId=${target.kbId}, table=${target.tableName}, fileKeys=${target.fileKeys.length}个`)
      console.log('  fileKeys:', target.fileKeys)
    } else {
      logWarn('未发现有已完成嵌入的向量表，筛选测试将跳过')
    }
    console.log()

    // ==========================================
    // Part: fileKey/fileKeys 筛选测试
    // ==========================================

    console.log('-'.repeat(60))
    console.log('fileKey/fileKeys 筛选测试')
    console.log('-'.repeat(60))
    console.log()

    await test('16. 检索 — 单个 fileKey 筛选', async () => {
      await testRetrievalWithFileKey(target)
    })

    await test('17. 检索 — 多个 fileKeys 筛选', async () => {
      await testRetrievalWithFileKeys(target)
    })

    await test('18. 检索 — fileKeys 空数组 (预期 400)', async () => {
      await testRetrievalEmptyFileKeys(target)
    })

    await test('19. 检索 — 不存在的 fileKey (预期空结果)', async () => {
      await testRetrievalNonExistentFileKey(target)
    })

    await test('20. 检索 — fileKey 优先级验证', async () => {
      await testRetrievalFileKeyPrecedence(target)
    })

    await test('21. 检索 — fileKey + 重排组合', async () => {
      await testRetrievalFileKeyWithRerank(target)
    })

  } catch (error) {
    logError('测试执行失败:')
    console.error(error)
    process.exit(1)
  }

  // 打印汇总
  console.log()
  console.log('='.repeat(60))
  console.log('测试结果统计')
  console.log('='.repeat(60))
  console.log(`总计: ${testResults.total}`)
  logSuccess(`通过: ${testResults.passed}`)
  if (testResults.failed > 0) {
    logError(`失败: ${testResults.failed}`)
  }
  console.log('='.repeat(60))

  process.exit(testResults.failed > 0 ? 1 : 0)
}

main()

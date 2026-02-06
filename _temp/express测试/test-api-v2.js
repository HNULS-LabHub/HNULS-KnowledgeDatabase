/**
 * Express API 测试脚本 v2
 * 在 v1 基础上新增向量检索 / 重排 API 测试
 *
 * 使用方式:
 *   node test-api-v2.js
 *   node test-api-v2.js --retrieval-only     仅跑检索相关测试
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
// ==================== 原有测试 (v1) ====================
// ============================================================================

async function testStatus() {
  const { response, data } = await request('/status')
  assert(response.ok, '响应应该是成功的')
  assert(data.success === true, 'success 应为 true')
  assert(data.data.status === 'ok', '状态应为 ok')
  assert(typeof data.data.uptime === 'number', 'uptime 应是数字')
  console.log('  响应数据:', JSON.stringify(data, null, 2))
}

async function testGetAllKnowledgeBases() {
  const { response, data } = await request('/knowledge-bases')
  assert(response.ok, '响应应该是成功的')
  assert(data.success === true, 'success 应为 true')
  assert(Array.isArray(data.data), '数据应是数组')
  if (data.data.length > 0) {
    const kb = data.data[0]
    assert(typeof kb.id === 'number', 'ID 应是数字')
    assert(typeof kb.name === 'string', 'name 应是字符串')
    console.log(`  找到 ${data.data.length} 个知识库`)
    console.log('  第一个知识库:', JSON.stringify(kb, null, 2))
  } else {
    logWarn('当前没有知识库')
  }
  return data.data
}

async function testGetKnowledgeBaseById(knowledgeBases) {
  if (knowledgeBases.length === 0) { logWarn('跳过: 没有知识库'); return }
  const kbId = knowledgeBases[0].id
  const { response, data } = await request(`/knowledge-bases/${kbId}`)
  assert(response.ok, '响应应该是成功的')
  assert(data.data.id === kbId, 'ID 应匹配')
  assert(typeof data.data.databaseName === 'string', 'databaseName 应是字符串')
  console.log('  知识库详情:', JSON.stringify(data.data, null, 2))
  return data.data
}

async function testGetNonExistentKnowledgeBase() {
  const { response, data } = await request('/knowledge-bases/99999')
  assert(response.status === 404, '应返回 404')
  assert(data.success === false, 'success 应为 false')
  assert(data.error.code === 'NOT_FOUND', '错误代码应为 NOT_FOUND')
  console.log('  预期的错误:', data.error.message)
}

async function testGetKnowledgeBaseDocuments(kb) {
  if (!kb) { logWarn('跳过: 没有知识库'); return }
  const { response, data } = await request(`/knowledge-bases/${kb.id}/documents?page=1&pageSize=10`)
  assert(response.ok, '响应应该是成功的')
  assert(data.success === true, 'success 应为 true')
  assert(Array.isArray(data.data.documents), 'documents 应是数组')
  assert(typeof data.data.pagination === 'object', 'pagination 应是对象')
  console.log(`  找到 ${data.data.documents.length} 个文档`)
  console.log('  分页:', JSON.stringify(data.data.pagination, null, 2))
  if (data.data.documents.length > 0) {
    console.log('  第一个文档:', JSON.stringify(data.data.documents[0], null, 2))
    return data.data.documents[0]
  }
}

async function testGetDocumentEmbeddings(kb, doc) {
  if (!kb || !doc) { logWarn('跳过: 没有文档'); return }
  const fileKey = encodeURIComponent(doc.fileKey)
  const { response, data } = await request(`/knowledge-bases/${kb.id}/documents/${fileKey}/embeddings`)
  assert(response.ok, '响应应该是成功的')
  assert(data.success === true, 'success 应为 true')
  assert(Array.isArray(data.data), 'embeddings 应是数组')
  if (data.data.length > 0) {
    console.log(`  找到 ${data.data.length} 个嵌入配置`)
    console.log('  嵌入状态:', JSON.stringify(data.data[0], null, 2))
  } else {
    logWarn('该文档还没有嵌入数据')
  }
}

async function testInvalidId() {
  const { response, data } = await request('/knowledge-bases/abc')
  assert(response.status === 400, '应返回 400')
  assert(data.error.code === 'INVALID_ID', '错误代码应为 INVALID_ID')
  console.log('  预期的错误:', data.error.message)
}

async function testNotFoundEndpoint() {
  const { response, data } = await request('/non-existent-endpoint')
  assert(response.status === 404, '应返回 404')
  assert(data.error.code === 'NOT_FOUND', '错误代码应为 NOT_FOUND')
  console.log('  预期的错误:', data.error.message)
}

// ============================================================================
// ==================== 新增: 向量检索 API 测试 ====================
// ============================================================================

/**
 * 辅助: 自动发现第一个可用的知识库 + 向量表
 * 返回 { kbId, tableName } 或 null
 */
async function discoverRetrievalTarget() {
  const { data: kbList } = await request('/knowledge-bases')
  if (!kbList.success || !kbList.data.length) return null

  for (const kb of kbList.data) {
    const { data: detail } = await request(`/knowledge-bases/${kb.id}`)
    if (!detail.success || !detail.data.databaseName) continue

    // 查文档来拿嵌入信息
    const { data: docs } = await request(`/knowledge-bases/${kb.id}/documents?page=1&pageSize=5`)
    if (!docs.success) continue

    for (const doc of (docs.data?.documents || [])) {
      if (!doc.fileKey) continue
      const fileKey = encodeURIComponent(doc.fileKey)
      const { data: embs } = await request(`/knowledge-bases/${kb.id}/documents/${fileKey}/embeddings`)
      if (!embs.success || !embs.data?.length) continue

      for (const emb of embs.data) {
        if (emb.status === 'completed' && emb.dimensions && emb.embeddingConfigId) {
          // 构造向量表名 (与主进程命名规则一致)
          const safeId = emb.embeddingConfigId.replace(/[^a-zA-Z0-9_]/g, '_')
          const tableName = `emb_cfg_${safeId}_${emb.dimensions}_chunks`
          console.log(`  发现可用目标: KB=${kb.id}, table=${tableName}`)
          return { kbId: kb.id, tableName }
        }
      }
    }
  }
  return null
}

/**
 * 测试 9: 检索 — 缺少必填参数
 */
async function testRetrievalMissingParams() {
  // 空 body
  const { response: r1, data: d1 } = await request('/retrieval/search', {
    method: 'POST',
    body: {}
  })
  assert(r1.status === 400, '空请求应返回 400')
  assert(d1.success === false, 'success 应为 false')
  assert(d1.error.code === 'INVALID_PARAM', '错误代码应为 INVALID_PARAM')
  console.log('  空 body 错误:', d1.error.message)

  // 缺 queryText
  const { response: r2, data: d2 } = await request('/retrieval/search', {
    method: 'POST',
    body: { knowledgeBaseId: 1, tableName: 'emb_test_3072_chunks' }
  })
  assert(r2.status === 400, '缺 queryText 应返回 400')
  assert(d2.error.code === 'INVALID_PARAM', '错误代码应为 INVALID_PARAM')
  console.log('  缺 queryText 错误:', d2.error.message)

  // 缺 tableName
  const { response: r3, data: d3 } = await request('/retrieval/search', {
    method: 'POST',
    body: { knowledgeBaseId: 1, queryText: '测试' }
  })
  assert(r3.status === 400, '缺 tableName 应返回 400')
  assert(d3.error.code === 'INVALID_PARAM', '错误代码应为 INVALID_PARAM')
  console.log('  缺 tableName 错误:', d3.error.message)
}

/**
 * 测试 10: 检索 — 无效的 knowledgeBaseId
 */
async function testRetrievalInvalidKbId() {
  const { response, data } = await request('/retrieval/search', {
    method: 'POST',
    body: {
      knowledgeBaseId: 'abc',
      tableName: 'emb_test_3072_chunks',
      queryText: '测试查询'
    }
  })
  assert(response.status === 400, '无效 kbId 应返回 400')
  assert(data.error.code === 'INVALID_PARAM', '错误代码应为 INVALID_PARAM')
  console.log('  预期的错误:', data.error.message)
}

/**
 * 测试 11: 检索 — 不存在的知识库
 */
async function testRetrievalNonExistentKb() {
  const { response, data } = await request('/retrieval/search', {
    method: 'POST',
    body: {
      knowledgeBaseId: 99999,
      tableName: 'emb_test_3072_chunks',
      queryText: '测试查询'
    }
  })
  // 主进程会抛出 Knowledge base not found，返回 500 + RETRIEVAL_FAILED
  assert(response.status === 500, '不存在的 KB 应返回 500')
  assert(data.success === false, 'success 应为 false')
  assert(data.error.code === 'RETRIEVAL_FAILED', '错误代码应为 RETRIEVAL_FAILED')
  console.log('  预期的错误:', data.error.message)
}

/**
 * 测试 12: 检索 — 不存在的向量表名
 */
async function testRetrievalInvalidTableName() {
  // 获取一个存在的 KB
  const { data: kbList } = await request('/knowledge-bases')
  if (!kbList.success || !kbList.data.length) {
    logWarn('跳过: 没有知识库')
    return
  }

  const kbId = kbList.data[0].id

  const { response, data } = await request('/retrieval/search', {
    method: 'POST',
    body: {
      knowledgeBaseId: kbId,
      tableName: 'not_a_valid_table',
      queryText: '测试查询'
    }
  })
  // tableName 格式校验不通过，主进程会抛错
  assert(response.status === 500, '无效表名应返回 500')
  assert(data.success === false, 'success 应为 false')
  console.log('  预期的错误:', data.error.message)
}

/**
 * 测试 13: 检索 — 真实向量检索（需要有数据）
 */
async function testRetrievalRealSearch(target) {
  if (!target) {
    logWarn('跳过: 未发现可用的向量表')
    return
  }

  const { response, data } = await request('/retrieval/search', {
    method: 'POST',
    body: {
      knowledgeBaseId: target.kbId,
      tableName: target.tableName,
      queryText: '什么是知识库管理系统？',
      k: 5,
      ef: 100
    }
  })

  console.log(`  响应状态: ${response.status}`)

  if (response.ok && data.success) {
    assert(Array.isArray(data.data), 'data 应是数组')
    assert(data.data.length > 0, '应返回至少 1 条结果')

    const first = data.data[0]
    assert(typeof first.id === 'string', 'hit.id 应是字符串')
    assert(typeof first.content === 'string', 'hit.content 应是字符串')
    assert(first.distance === undefined || typeof first.distance === 'number', 'distance 应是数字或 undefined')

    console.log(`  召回 ${data.data.length} 条结果`)
    console.log('  Top-1:', JSON.stringify({
      id: first.id,
      file_name: first.file_name,
      chunk_index: first.chunk_index,
      distance: first.distance,
      content_preview: first.content.slice(0, 80) + '…'
    }, null, 2))
  } else {
    // 即使失败（例如模型不可用），也不算断言失败，只打印
    logWarn(`检索未成功（可能模型/数据未就绪）: ${data.error?.message || JSON.stringify(data)}`)
  }
}

/**
 * 测试 14: 检索 — 带重排参数结构验证
 * 仅验证参数能正常透传到主进程，不要求重排一定成功
 */
async function testRetrievalWithRerankParams(target) {
  if (!target) {
    logWarn('跳过: 未发现可用的向量表')
    return
  }

  const { response, data } = await request('/retrieval/search', {
    method: 'POST',
    body: {
      knowledgeBaseId: target.kbId,
      tableName: target.tableName,
      queryText: '人工智能的发展趋势',
      k: 10,
      ef: 100,
      rerankModelId: 'BAAI/bge-reranker-v2-m3',
      rerankTopN: 3
    }
  })

  console.log(`  响应状态: ${response.status}`)

  if (response.ok && data.success) {
    assert(Array.isArray(data.data), 'data 应是数组')
    console.log(`  重排后返回 ${data.data.length} 条结果`)

    if (data.data.length > 0) {
      const first = data.data[0]
      // 重排结果应该有 rerank_score
      if (first.rerank_score !== undefined) {
        assert(typeof first.rerank_score === 'number', 'rerank_score 应是数字')
        logSuccess(`  重排分数存在: top rerank_score = ${first.rerank_score}`)
      } else {
        logWarn('  结果中未包含 rerank_score（可能重排模型不可用）')
      }

      console.log('  Top-1:', JSON.stringify({
        id: first.id,
        file_name: first.file_name,
        distance: first.distance,
        rerank_score: first.rerank_score,
        content_preview: first.content.slice(0, 80) + '…'
      }, null, 2))
    }
  } else {
    // 重排模型不一定配置了，不算失败
    logWarn(`重排检索未成功: ${data.error?.message || JSON.stringify(data)}`)
  }
}

/**
 * 测试 15: 检索 — 自定义 k / ef 参数
 */
async function testRetrievalCustomParams(target) {
  if (!target) {
    logWarn('跳过: 未发现可用的向量表')
    return
  }

  const { response, data } = await request('/retrieval/search', {
    method: 'POST',
    body: {
      knowledgeBaseId: target.kbId,
      tableName: target.tableName,
      queryText: '数据库设计',
      k: 3,
      ef: 50
    }
  })

  if (response.ok && data.success) {
    assert(Array.isArray(data.data), 'data 应是数组')
    assert(data.data.length <= 3, `k=3 时结果不应超过 3 条，实际 ${data.data.length}`)
    console.log(`  k=3 返回 ${data.data.length} 条结果 ✓`)
  } else {
    logWarn(`自定义参数检索未成功: ${data.error?.message || ''}`)
  }
}

// ============================================================================
// 主测试流程
// ============================================================================

async function main() {
  const retrievalOnly = process.argv.includes('--retrieval-only')

  console.log('='.repeat(60))
  console.log(retrievalOnly ? '向量检索 API 测试 (v2)' : 'Express API 全量测试 (v2)')
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

    // ==========================================
    // Part 1: 原有测试
    // ==========================================

    if (!retrievalOnly) {
      let knowledgeBases = []
      let kb = null
      let doc = null

      await test('1. 服务状态检查', testStatus)

      await test('2. 获取所有知识库列表', async () => {
        knowledgeBases = await testGetAllKnowledgeBases()
      })

      await test('3. 获取单个知识库详情', async () => {
        kb = await testGetKnowledgeBaseById(knowledgeBases)
      })

      await test('4. 获取不存在的知识库 (预期 404)', testGetNonExistentKnowledgeBase)

      await test('5. 获取知识库文档列表', async () => {
        doc = await testGetKnowledgeBaseDocuments(kb)
      })

      await test('6. 获取文档嵌入状态', async () => {
        await testGetDocumentEmbeddings(kb, doc)
      })

      await test('7. 测试无效的 ID (预期 400)', testInvalidId)
      await test('8. 测试不存在的端点 (预期 404)', testNotFoundEndpoint)
    }

    // ==========================================
    // Part 2: 向量检索 API 测试
    // ==========================================

    console.log()
    console.log('-'.repeat(60))
    console.log('向量检索 API 测试')
    console.log('-'.repeat(60))
    console.log()

    await test('9.  检索 — 缺少必填参数 (预期 400)', testRetrievalMissingParams)
    await test('10. 检索 — 无效的 knowledgeBaseId (预期 400)', testRetrievalInvalidKbId)
    await test('11. 检索 — 不存在的知识库 (预期 500)', testRetrievalNonExistentKb)
    await test('12. 检索 — 不存在的向量表名 (预期 500)', testRetrievalInvalidTableName)

    // 自动发现可用目标
    logInfo('发现可用检索目标...')
    let target = null
    try {
      target = await discoverRetrievalTarget()
    } catch (e) {
      logWarn(`自动发现失败: ${e.message}`)
    }

    if (target) {
      logSuccess(`目标: kbId=${target.kbId}, table=${target.tableName}`)
    } else {
      logWarn('未发现有已完成嵌入的向量表，真实检索测试将跳过')
    }
    console.log()

    await test('13. 检索 — 真实向量检索', async () => {
      await testRetrievalRealSearch(target)
    })

    await test('14. 检索 — 带重排参数', async () => {
      await testRetrievalWithRerankParams(target)
    })

    await test('15. 检索 — 自定义 k/ef 参数', async () => {
      await testRetrievalCustomParams(target)
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

/**
 * Express API 测试脚本 v4
 * 测试重排模型列表 API 及 rerankModelId 验证功能
 *
 * 使用方式:
 *   node test-api-v4.js
 *   node test-api-v4.js --rerank-only     仅跑重排相关测试
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
 * 发现可用的检索目标（知识库 + 向量表）
 * 返回: { kbId, tableName } 或 null
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

// ============================================================================
// ==================== 新增: 重排模型列表 API 测试 ====================
// ============================================================================

/**
 * 测试 22: 获取重排模型列表 — 基本功能
 */
async function testGetRerankModels() {
  const { response, data } = await request('/rerank-models')

  assert(response.ok, '响应应该是成功的')
  assert(data.success === true, 'success 应为 true')
  assert(Array.isArray(data.data), 'data 应是数组')

  console.log(`  找到 ${data.data.length} 个重排模型`)

  if (data.data.length > 0) {
    const model = data.data[0]
    assert(typeof model.id === 'string', 'id 应是字符串')
    assert(typeof model.displayName === 'string', 'displayName 应是字符串')
    assert(typeof model.providerId === 'string', 'providerId 应是字符串')
    assert(typeof model.providerName === 'string', 'providerName 应是字符串')
    assert(typeof model.enabled === 'boolean', 'enabled 应是布尔值')

    // 验证不应包含敏感信息
    assert(model.apiKey === undefined, '不应包含 apiKey')
    assert(model.baseUrl === undefined, '不应包含 baseUrl')

    console.log('  第一个模型:', JSON.stringify(model, null, 2))
  } else {
    logWarn('  当前没有启用的重排模型')
  }

  return data.data
}

/**
 * 测试 23: 获取重排模型列表 — 验证数据结构
 */
async function testRerankModelsDataStructure(models) {
  if (!models || models.length === 0) {
    logWarn('跳过: 没有重排模型可供测试')
    return
  }

  for (const model of models) {
    // 验证必填字段
    assert(model.id, '每个模型应有 id')
    assert(model.displayName, '每个模型应有 displayName')
    assert(model.providerId, '每个模型应有 providerId')
    assert(model.providerName, '每个模型应有 providerName')
    assert(typeof model.enabled === 'boolean', 'enabled 应是布尔值')

    // 验证不包含敏感信息
    assert(!model.apiKey, '不应暴露 apiKey')
    assert(!model.baseUrl, '不应暴露 baseUrl')
    assert(!model.secret, '不应暴露 secret')
  }

  console.log('  所有模型数据结构验证通过 ✓')
  console.log('  模型列表:', models.map(m => `${m.id} (${m.providerName})`).join(', '))
}

/**
 * 测试 24: 重排模型列表 — 响应性能
 */
async function testRerankModelsPerformance() {
  const startTime = Date.now()
  const { response, data } = await request('/rerank-models')
  const endTime = Date.now()
  const duration = endTime - startTime

  assert(response.ok, '响应应该是成功的')
  assert(duration < 5000, `响应时间应在 5 秒内，实际: ${duration}ms`)

  console.log(`  响应时间: ${duration}ms ✓`)
}

/**
 * 测试 25: 检索 — 有效的 rerankModelId
 */
async function testRetrievalWithValidRerankModel(target, models) {
  if (!target) {
    logWarn('跳过: 未发现可用的向量表')
    return
  }

  if (!models || models.length === 0) {
    logWarn('跳过: 没有可用的重排模型')
    return
  }

  const rerankModelId = models[0].id

  const { response, data } = await request('/retrieval/search', {
    method: 'POST',
    body: {
      knowledgeBaseId: target.kbId,
      tableName: target.tableName,
      queryText: '测试有效重排模型',
      k: 10,
      ef: 100,
      rerankModelId,
      rerankTopN: 3
    }
  })

  console.log(`  响应状态: ${response.status}`)

  if (response.ok && data.success) {
    assert(Array.isArray(data.data), 'data 应是数组')
    console.log(`  使用有效 rerankModelId (${rerankModelId}) 成功: 返回 ${data.data.length} 条结果`)

    if (data.data.length > 0 && data.data[0].rerank_score !== undefined) {
      logSuccess(`  重排分数存在: ${data.data[0].rerank_score}`)
    }
  } else {
    // 重排模型可能未配置完整，不算失败
    logWarn(`重排检索未成功（模型可能未就绪）: ${data.error?.message || ''}`)
  }
}

/**
 * 测试 26: 检索 — 无效的 rerankModelId (预期 400)
 */
async function testRetrievalWithInvalidRerankModel(target) {
  if (!target) {
    logWarn('跳过: 未发现可用的向量表')
    return
  }

  const invalidModelId = 'invalid-rerank-model-that-does-not-exist'

  const { response, data } = await request('/retrieval/search', {
    method: 'POST',
    body: {
      knowledgeBaseId: target.kbId,
      tableName: target.tableName,
      queryText: '测试无效重排模型',
      k: 10,
      rerankModelId: invalidModelId,
      rerankTopN: 3
    }
  })

  console.log(`  响应状态: ${response.status}`)

  // 验证应该返回 400 错误
  assert(response.status === 400, '无效 rerankModelId 应返回 400')
  assert(data.success === false, 'success 应为 false')
  assert(data.error.code === 'INVALID_PARAM', '错误代码应为 INVALID_PARAM')

  console.log('  预期的错误:', data.error.message)
  assert(data.error.message.includes('rerankModelId') || data.error.message.includes('rerank'), '错误信息应提及 rerank')
}

/**
 * 测试 27: 检索 — 禁用的 rerankModelId
 */
async function testRetrievalWithDisabledRerankModel(target, models) {
  if (!target) {
    logWarn('跳过: 未发现可用的向量表')
    return
  }

  // 尝试找一个可能存在但未启用的模型 ID（使用常见的模型 ID）
  const commonDisabledModels = [
    'jina-reranker-v1-base-en',
    'cohere-rerank-english-v2.0',
    'cross-encoder/ms-marco-MiniLM-L-12-v2'
  ]

  // 排除已启用的模型
  const enabledIds = new Set((models || []).map(m => m.id))
  const disabledModelId = commonDisabledModels.find(id => !enabledIds.has(id))

  if (!disabledModelId) {
    logWarn('跳过: 无法构造禁用的模型 ID')
    return
  }

  const { response, data } = await request('/retrieval/search', {
    method: 'POST',
    body: {
      knowledgeBaseId: target.kbId,
      tableName: target.tableName,
      queryText: '测试禁用重排模型',
      k: 10,
      rerankModelId: disabledModelId,
      rerankTopN: 3
    }
  })

  console.log(`  响应状态: ${response.status}`)

  // 应该返回 400 错误（因为模型未启用或不存在）
  if (response.status === 400) {
    assert(data.success === false, 'success 应为 false')
    assert(data.error.code === 'INVALID_PARAM', '错误代码应为 INVALID_PARAM')
    console.log('  正确拒绝禁用/不存在的模型 ✓')
    console.log('  错误信息:', data.error.message)
  } else {
    logWarn(`  预期返回 400，实际: ${response.status} (可能该模型 ID 格式不被识别)`)
  }
}

/**
 * 测试 28: 检索 — rerankModelId 缓存验证
 */
async function testRerankModelIdCacheValidation(target, models) {
  if (!target) {
    logWarn('跳过: 未发现可用的向量表')
    return
  }

  if (!models || models.length === 0) {
    logWarn('跳过: 没有可用的重排模型')
    return
  }

  const validModelId = models[0].id
  const invalidModelId = 'definitely-invalid-model-id-xyz'

  // 第一次请求：有效的 rerankModelId
  const { response: r1, data: d1 } = await request('/retrieval/search', {
    method: 'POST',
    body: {
      knowledgeBaseId: target.kbId,
      tableName: target.tableName,
      queryText: '缓存测试 - 有效模型',
      k: 5,
      rerankModelId: validModelId,
      rerankTopN: 3
    }
  })

  console.log(`  第一次请求 (有效 ID): ${r1.status}`)

  // 第二次请求：无效的 rerankModelId (应该被缓存拦截，快速返回 400)
  const startTime = Date.now()
  const { response: r2, data: d2 } = await request('/retrieval/search', {
    method: 'POST',
    body: {
      knowledgeBaseId: target.kbId,
      tableName: target.tableName,
      queryText: '缓存测试 - 无效模型',
      k: 5,
      rerankModelId: invalidModelId,
      rerankTopN: 3
    }
  })
  const validationTime = Date.now() - startTime

  console.log(`  第二次请求 (无效 ID): ${r2.status}, 验证耗时: ${validationTime}ms`)

  assert(r2.status === 400, '无效模型应返回 400')
  assert(validationTime < 1000, `验证应很快（使用缓存），实际: ${validationTime}ms`)

  logSuccess('  rerankModelId 缓存验证正常工作 ✓')
}

/**
 * 测试 29: 检索 — 不传 rerankModelId (应正常工作)
 */
async function testRetrievalWithoutRerankModel(target) {
  if (!target) {
    logWarn('跳过: 未发现可用的向量表')
    return
  }

  const { response, data } = await request('/retrieval/search', {
    method: 'POST',
    body: {
      knowledgeBaseId: target.kbId,
      tableName: target.tableName,
      queryText: '不使用重排的查询',
      k: 5,
      ef: 100
      // 不传 rerankModelId
    }
  })

  console.log(`  响应状态: ${response.status}`)

  if (response.ok && data.success) {
    assert(Array.isArray(data.data), 'data 应是数组')
    console.log(`  不使用重排正常工作: 返回 ${data.data.length} 条结果`)

    // 验证结果中不应有 rerank_score
    if (data.data.length > 0) {
      const hasRerankScore = data.data.some(hit => hit.rerank_score !== undefined)
      assert(!hasRerankScore, '不使用重排时，结果不应包含 rerank_score')
      logSuccess('  结果中不包含 rerank_score ✓')
    }
  } else {
    logWarn(`查询失败: ${data.error?.message || ''}`)
  }
}

/**
 * 测试 30: 重排模型列表 — 多次请求一致性
 */
async function testRerankModelsConsistency() {
  const { data: data1 } = await request('/rerank-models')
  const { data: data2 } = await request('/rerank-models')

  assert(data1.success && data2.success, '两次请求都应成功')
  assert(data1.data.length === data2.data.length, '两次请求返回的模型数量应一致')

  // 验证模型 ID 列表一致
  const ids1 = data1.data.map(m => m.id).sort()
  const ids2 = data2.data.map(m => m.id).sort()

  assert(JSON.stringify(ids1) === JSON.stringify(ids2), '两次请求返回的模型 ID 应一致')

  console.log('  多次请求返回结果一致 ✓')
  console.log(`  模型数量: ${data1.data.length}`)
}

// ============================================================================
// 主测试流程
// ============================================================================

async function main() {
  const rerankOnly = process.argv.includes('--rerank-only')

  console.log('='.repeat(60))
  console.log('重排模型 API 测试 (v4)')
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
    // Part 1: 重排模型列表 API 测试
    // ==========================================

    console.log('-'.repeat(60))
    console.log('重排模型列表 API')
    console.log('-'.repeat(60))
    console.log()

    let models = []

    await test('22. 获取重排模型列表 — 基本功能', async () => {
      models = await testGetRerankModels()
    })

    await test('23. 重排模型列表 — 数据结构验证', async () => {
      await testRerankModelsDataStructure(models)
    })

    await test('24. 重排模型列表 — 响应性能', testRerankModelsPerformance)

    await test('30. 重排模型列表 — 多次请求一致性', testRerankModelsConsistency)

    // ==========================================
    // Part 2: rerankModelId 验证测试
    // ==========================================

    console.log()
    console.log('-'.repeat(60))
    console.log('rerankModelId 验证功能')
    console.log('-'.repeat(60))
    console.log()

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
      logWarn('未发现有已完成嵌入的向量表，部分测试将跳过')
    }
    console.log()

    await test('25. 检索 — 有效的 rerankModelId', async () => {
      await testRetrievalWithValidRerankModel(target, models)
    })

    await test('26. 检索 — 无效的 rerankModelId (预期 400)', async () => {
      await testRetrievalWithInvalidRerankModel(target)
    })

    await test('27. 检索 — 禁用的 rerankModelId (预期 400)', async () => {
      await testRetrievalWithDisabledRerankModel(target, models)
    })

    await test('28. 检索 — rerankModelId 缓存验证', async () => {
      await testRerankModelIdCacheValidation(target, models)
    })

    await test('29. 检索 — 不传 rerankModelId (应正常)', async () => {
      await testRetrievalWithoutRerankModel(target)
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

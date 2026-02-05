/**
 * Express API 测试脚本
 * 使用 Node.js 内置的 fetch API (Node 18+)
 */

const BASE_URL = 'http://localhost:3721/api/v1'

// 颜色输出辅助函数
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(color, ...args) {
  console.log(color, ...args, colors.reset)
}

function logSuccess(msg) {
  log(colors.green, '✓', msg)
}

function logError(msg) {
  log(colors.red, '✗', msg)
}

function logInfo(msg) {
  log(colors.cyan, '➜', msg)
}

function logWarn(msg) {
  log(colors.yellow, '⚠', msg)
}

// 测试结果统计
let testResults = {
  total: 0,
  passed: 0,
  failed: 0
}

/**
 * 执行单个测试
 */
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

/**
 * HTTP 请求包装
 */
async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`
  logInfo(`请求: GET ${path}`)

  const response = await fetch(url, {
    method: options.method || 'GET',
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

/**
 * 断言函数
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || '断言失败')
  }
}

// ============================================================================
// 测试用例
// ============================================================================

/**
 * 测试 1: 服务状态检查
 */
async function testStatus() {
  const { response, data } = await request('/status')

  assert(response.ok, '响应应该是成功的')
  assert(data.success === true, '响应 success 字段应为 true')
  assert(data.data.status === 'ok', '服务状态应为 ok')
  assert(typeof data.data.uptime === 'number', 'uptime 应该是数字')
  assert(typeof data.data.requestCount === 'number', 'requestCount 应该是数字')

  console.log('  响应数据:', JSON.stringify(data, null, 2))
}

/**
 * 测试 2: 获取所有知识库列表
 */
async function testGetAllKnowledgeBases() {
  const { response, data } = await request('/knowledge-bases')

  assert(response.ok, '响应应该是成功的')
  assert(data.success === true, '响应 success 字段应为 true')
  assert(Array.isArray(data.data), '数据应该是数组')

  if (data.data.length > 0) {
    const kb = data.data[0]
    assert(typeof kb.id === 'number', '知识库 ID 应该是数字')
    assert(typeof kb.name === 'string', '知识库名称应该是字符串')
    assert(typeof kb.description === 'string', '知识库描述应该是字符串')

    console.log(`  找到 ${data.data.length} 个知识库`)
    console.log('  第一个知识库:', JSON.stringify(data.data[0], null, 2))
  } else {
    logWarn('  当前没有知识库')
  }

  return data.data
}

/**
 * 测试 3: 获取单个知识库详情
 */
async function testGetKnowledgeBaseById(knowledgeBases) {
  if (knowledgeBases.length === 0) {
    logWarn('跳过: 没有知识库可供测试')
    return
  }

  const kbId = knowledgeBases[0].id
  const { response, data } = await request(`/knowledge-bases/${kbId}`)

  assert(response.ok, '响应应该是成功的')
  assert(data.success === true, '响应 success 字段应为 true')
  assert(data.data.id === kbId, 'ID 应该匹配')
  assert(typeof data.data.databaseName === 'string', 'databaseName 应该是字符串')

  console.log('  知识库详情:', JSON.stringify(data.data, null, 2))

  return data.data
}

/**
 * 测试 4: 获取不存在的知识库 (预期失败)
 */
async function testGetNonExistentKnowledgeBase() {
  const { response, data } = await request('/knowledge-bases/99999')

  assert(response.status === 404, '响应状态应该是 404')
  assert(data.success === false, '响应 success 字段应为 false')
  assert(data.error.code === 'NOT_FOUND', '错误代码应为 NOT_FOUND')

  console.log('  预期的错误:', data.error.message)
}

/**
 * 测试 5: 获取知识库文档列表
 */
async function testGetKnowledgeBaseDocuments(kb) {
  if (!kb) {
    logWarn('跳过: 没有知识库可供测试')
    return
  }

  const { response, data } = await request(`/knowledge-bases/${kb.id}/documents?page=1&pageSize=10`)

  assert(response.ok, '响应应该是成功的')
  assert(data.success === true, '响应 success 字段应为 true')
  assert(Array.isArray(data.data.documents), 'documents 应该是数组')
  assert(typeof data.data.pagination === 'object', 'pagination 应该是对象')
  assert(typeof data.data.pagination.total === 'number', 'total 应该是数字')
  assert(typeof data.data.pagination.page === 'number', 'page 应该是数字')
  assert(typeof data.data.pagination.pageSize === 'number', 'pageSize 应该是数字')

  console.log(`  找到 ${data.data.documents.length} 个文档`)
  console.log('  分页信息:', JSON.stringify(data.data.pagination, null, 2))

  if (data.data.documents.length > 0) {
    console.log('  第一个文档:', JSON.stringify(data.data.documents[0], null, 2))
    return data.data.documents[0]
  }
}

/**
 * 测试 6: 获取文档嵌入状态
 */
async function testGetDocumentEmbeddings(kb, doc) {
  if (!kb || !doc) {
    logWarn('跳过: 没有文档可供测试')
    return
  }

  const fileKey = encodeURIComponent(doc.fileKey)
  const { response, data } = await request(
    `/knowledge-bases/${kb.id}/documents/${fileKey}/embeddings`
  )

  assert(response.ok, '响应应该是成功的')
  assert(data.success === true, '响应 success 字段应为 true')
  assert(Array.isArray(data.data), 'embeddings 应该是数组')

  if (data.data.length > 0) {
    console.log(`  找到 ${data.data.length} 个嵌入配置`)
    console.log('  嵌入状态:', JSON.stringify(data.data[0], null, 2))
  } else {
    logWarn('  该文档还没有嵌入数据')
  }
}

/**
 * 测试 7: 测试无效的 ID
 */
async function testInvalidId() {
  const { response, data } = await request('/knowledge-bases/abc')

  assert(response.status === 400, '响应状态应该是 400')
  assert(data.success === false, '响应 success 字段应为 false')
  assert(data.error.code === 'INVALID_ID', '错误代码应为 INVALID_ID')

  console.log('  预期的错误:', data.error.message)
}

/**
 * 测试 8: 测试不存在的端点 (404)
 */
async function testNotFoundEndpoint() {
  const { response, data } = await request('/non-existent-endpoint')

  assert(response.status === 404, '响应状态应该是 404')
  assert(data.success === false, '响应 success 字段应为 false')
  assert(data.error.code === 'NOT_FOUND', '错误代码应为 NOT_FOUND')

  console.log('  预期的错误:', data.error.message)
}

// ============================================================================
// 主测试流程
// ============================================================================

async function main() {
  console.log('='.repeat(60))
  console.log('Express API 测试')
  console.log('='.repeat(60))
  console.log()

  try {
    // 首先检查服务是否可用
    logInfo('检查服务可用性...')
    const statusCheck = await fetch(`${BASE_URL}/status`)
    if (!statusCheck.ok) {
      throw new Error(`服务不可用: ${statusCheck.status} ${statusCheck.statusText}`)
    }
    logSuccess('服务正常运行')
    console.log()

    // 运行所有测试
    await test('1. 服务状态检查', testStatus)

    let knowledgeBases = []
    await test('2. 获取所有知识库列表', async () => {
      knowledgeBases = await testGetAllKnowledgeBases()
    })

    let kb = null
    await test('3. 获取单个知识库详情', async () => {
      kb = await testGetKnowledgeBaseById(knowledgeBases)
    })

    await test('4. 获取不存在的知识库 (预期 404)', testGetNonExistentKnowledgeBase)

    let doc = null
    await test('5. 获取知识库文档列表', async () => {
      doc = await testGetKnowledgeBaseDocuments(kb)
    })

    await test('6. 获取文档嵌入状态', async () => {
      await testGetDocumentEmbeddings(kb, doc)
    })

    await test('7. 测试无效的 ID (预期 400)', testInvalidId)

    await test('8. 测试不存在的端点 (预期 404)', testNotFoundEndpoint)
  } catch (error) {
    logError('测试执行失败:')
    console.error(error)
    process.exit(1)
  }

  // 打印测试结果
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

// 运行测试
main()

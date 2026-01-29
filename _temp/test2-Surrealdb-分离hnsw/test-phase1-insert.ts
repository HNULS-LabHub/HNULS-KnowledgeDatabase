/**
 * 阶段1测试：无 HNSW 索引的向量插入测试
 * 
 * 目标：
 * 1. 创建表（不带 HNSW 索引）
 * 2. 批量插入向量数据
 * 3. 验证数据完整性
 * 4. 测量插入性能
 */

import {
  SurrealDBQueryLogger,
  generateTestData,
  measureTime
} from './utils'

const TEST_CONFIG = {
  endpoint: 'http://127.0.0.1:8888', // 连接外部持久数据库
  namespace: 'test',
  database: 'phase1_insert',
  tableName: 'test_emb_chunks',
  dimension: 1536,
  testSizes: [100, 1000] // 测试数据量
}

async function runPhase1Test() {
  const queryLogger = new SurrealDBQueryLogger('phase1-insert-log.json')

  try {
    console.log('='.repeat(60))
    console.log('Phase 1: 无索引插入测试')
    console.log('='.repeat(60))

    // 1. 连接数据库
    console.log('\n[Step 1] Connecting to database...')
    console.log(`  Endpoint: ${TEST_CONFIG.endpoint}`)
    console.log(`  Namespace: ${TEST_CONFIG.namespace}`)
    console.log(`  Database: ${TEST_CONFIG.database}`)
    await queryLogger.connect(
      TEST_CONFIG.endpoint,
      TEST_CONFIG.namespace,
      TEST_CONFIG.database
    )

    // 2. 清理旧表（如果存在）
    console.log('\n[Step 2] Cleaning up existing table...')
    try {
      await queryLogger.query(`
        REMOVE TABLE IF EXISTS ${TEST_CONFIG.tableName};
      `)
      console.log('✓ Old table removed')
    } catch (error) {
      console.log('No old table to remove')
    }

    // 3. 创建表（无 HNSW 索引）
    console.log('\n[Step 3] Creating table without HNSW index...')
    await queryLogger.query(`
      DEFINE TABLE ${TEST_CONFIG.tableName} SCHEMAFULL;
    `)

    await queryLogger.query(`
      DEFINE FIELD embedding ON ${TEST_CONFIG.tableName} TYPE array;
    `)

    await queryLogger.query(`
      DEFINE FIELD content ON ${TEST_CONFIG.tableName} TYPE string;
    `)

    await queryLogger.query(`
      DEFINE FIELD chunk_index ON ${TEST_CONFIG.tableName} TYPE int;
    `)

    console.log('✓ Table created without HNSW index')

    // 4. 验证表结构
    console.log('\n[Step 4] Verifying table structure...')
    const tableInfo = await queryLogger.query(`
      INFO FOR TABLE ${TEST_CONFIG.tableName};
    `)
    console.log('Table info:', tableInfo)

    // 5. 对不同数据量进行插入测试
    for (const testSize of TEST_CONFIG.testSizes) {
      console.log('\n' + '-'.repeat(60))
      console.log(`[Test] Inserting ${testSize} records...`)
      console.log('-'.repeat(60))

      // 生成测试数据
      const testData = generateTestData(testSize, TEST_CONFIG.dimension)
      console.log(`Generated ${testData.length} test records`)

      // 方式1：单条插入
      console.log('\n[Method 1] Single record insertion...')
      const singleInsertResult = await measureTime('single-insert', async () => {
        for (let i = 0; i < testData.length; i++) {
          await queryLogger.query(`
            INSERT INTO ${TEST_CONFIG.tableName} {
              embedding: $embedding,
              content: $content,
              chunk_index: $chunk_index
            };
          `, {
            embedding: testData[i].embedding,
            content: testData[i].content,
            chunk_index: i
          })
        }
      })
      console.log(`✓ Single insert completed: ${singleInsertResult.duration}ms`)
      console.log(`  Average: ${(singleInsertResult.duration / testData.length).toFixed(2)}ms/record`)

      // 验证插入数量
      const countAfterSingle = await queryLogger.query(`
        SELECT count() FROM ${TEST_CONFIG.tableName} GROUP ALL;
      `)
      console.log(`Records in table: ${JSON.stringify(countAfterSingle)}`)

      // 清理表以测试批量插入
      console.log('\n[Cleanup] Clearing table for batch insert test...')
      await queryLogger.query(`DELETE ${TEST_CONFIG.tableName};`)

      // 方式2：批量插入（如果支持）
      console.log('\n[Method 2] Batch insertion...')
      const batchInsertResult = await measureTime('batch-insert', async () => {
        // 分批插入（每批100条）
        const batchSize = 100
        for (let i = 0; i < testData.length; i += batchSize) {
          const batch = testData.slice(i, i + batchSize)
          const records = batch.map((item, idx) => ({
            embedding: item.embedding,
            content: item.content,
            chunk_index: i + idx
          }))

          await queryLogger.query(`
            INSERT INTO ${TEST_CONFIG.tableName} $records;
          `, { records })
        }
      })
      console.log(`✓ Batch insert completed: ${batchInsertResult.duration}ms`)
      console.log(`  Average: ${(batchInsertResult.duration / testData.length).toFixed(2)}ms/record`)

      // 验证插入数量
      const countAfterBatch = await queryLogger.query(`
        SELECT count() FROM ${TEST_CONFIG.tableName} GROUP ALL;
      `)
      console.log(`Records in table: ${JSON.stringify(countAfterBatch)}`)

      // 6. 数据完整性验证
      console.log('\n[Step 6] Data integrity check...')
      const sampleQuery = await queryLogger.query(`
        SELECT * FROM ${TEST_CONFIG.tableName} LIMIT 5;
      `)
      console.log('Sample records:', JSON.stringify(sampleQuery, null, 2))

      // 验证向量维度
      const firstRecord: any = await queryLogger.query(`
        SELECT * FROM ${TEST_CONFIG.tableName} LIMIT 1;
      `)
      if (firstRecord && firstRecord[0]?.result?.[0]?.embedding) {
        const embeddingLength = firstRecord[0].result[0].embedding.length
        console.log(`✓ Vector dimension verified: ${embeddingLength} (expected: ${TEST_CONFIG.dimension})`)
        
        if (embeddingLength !== TEST_CONFIG.dimension) {
          console.error('❌ Dimension mismatch!')
        }
      }

      // 清理以进行下一轮测试
      if (testSize !== TEST_CONFIG.testSizes[TEST_CONFIG.testSizes.length - 1]) {
        console.log('\n[Cleanup] Clearing table for next test size...')
        await queryLogger.query(`DELETE ${TEST_CONFIG.tableName};`)
      }
    }

    // 7. 生成测试报告
    console.log('\n' + '='.repeat(60))
    console.log('Phase 1 Test Summary')
    console.log('='.repeat(60))
    const stats = queryLogger.getStats()
    console.log(`Total queries executed: ${stats.totalQueries}`)
    console.log(`Log file: ${stats.logFile}`)
    console.log('\n✓ Phase 1 completed successfully')

  } catch (error) {
    console.error('\n❌ Test failed:', error)
    throw error
  } finally {
    // 清理
    console.log('\n[Cleanup] Closing connections...')
    await queryLogger.close()
  }
}

// 运行测试
if (require.main === module) {
  runPhase1Test()
    .then(() => {
      console.log('\n✓ All tests completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Test suite failed:', error)
      process.exit(1)
    })
}

export { runPhase1Test }

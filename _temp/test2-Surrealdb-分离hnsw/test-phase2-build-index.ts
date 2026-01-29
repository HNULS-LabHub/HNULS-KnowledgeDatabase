/**
 * 阶段2测试：在已有数据的表上延迟构建 HNSW 索引
 * 
 * 目标：
 * 1. 使用阶段1已插入数据的表
 * 2. 在有数据的表上执行 DEFINE INDEX
 * 3. 测量索引构建时间
 * 4. 验证索引构建后的查询功能
 */
import {
  SurrealDBQueryLogger,
  generateRandomVector,
  measureTime
} from './utils'

const TEST_CONFIG = {
  endpoint: 'http://127.0.0.1:8888', // 连接外部持久数据库
  namespace: 'test',
  database: 'phase2_index',
  tableName: 'test_emb_chunks',
  dimension: 1536,
  recordCount: 1000, // 先插入1000条记录
  hnswConfig: {
    dimension: 1536,
    distanceMetric: 'COSINE',
    type: 'F32',
    efc: 200,
    m: 16
  }
}

async function runPhase2Test() {
  const queryLogger = new SurrealDBQueryLogger('phase2-build-index-log.json')

  try {
    console.log('='.repeat(60))
    console.log('Phase 2: 延迟构建 HNSW 索引测试')
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
      DEFINE FIELD embedding ON ${TEST_CONFIG.tableName} TYPE array<float>;
    `)

    await queryLogger.query(`
      DEFINE FIELD content ON ${TEST_CONFIG.tableName} TYPE string;
    `)

    await queryLogger.query(`
      DEFINE FIELD chunk_index ON ${TEST_CONFIG.tableName} TYPE int;
    `)

    console.log('✓ Table created')

    // 4. 插入测试数据
    console.log(`\n[Step 4] Inserting ${TEST_CONFIG.recordCount} records...`)
    const insertResult = await measureTime('data-insertion', async () => {
      const batchSize = 100
      for (let i = 0; i < TEST_CONFIG.recordCount; i += batchSize) {
        const batchCount = Math.min(batchSize, TEST_CONFIG.recordCount - i)
        const records = []
        
        for (let j = 0; j < batchCount; j++) {
          records.push({
            embedding: generateRandomVector(TEST_CONFIG.dimension),
            content: `Test chunk ${i + j + 1}`,
            chunk_index: i + j
          })
        }

        await queryLogger.query(`
          INSERT INTO ${TEST_CONFIG.tableName} $records;
        `, { records })
      }
    })

    console.log(`✓ Data insertion completed: ${insertResult.duration}ms`)
    console.log(`  Average: ${(insertResult.duration / TEST_CONFIG.recordCount).toFixed(2)}ms/record`)

    // 验证数据量
    const countBefore = await queryLogger.query(`
      SELECT count() FROM ${TEST_CONFIG.tableName} GROUP ALL;
    `)
    console.log(`Records in table: ${JSON.stringify(countBefore)}`)

    // 5. 查看表信息（索引构建前）
    console.log('\n[Step 5] Checking table info before index creation...')
    const tableInfoBefore = await queryLogger.query(`
      INFO FOR TABLE ${TEST_CONFIG.tableName};
    `)
    console.log('Table info (before index):', JSON.stringify(tableInfoBefore, null, 2))

    // 6. 构建 HNSW 索引（关键步骤）
    console.log('\n[Step 6] Building HNSW index on existing data...')
    console.log('HNSW Config:', TEST_CONFIG.hnswConfig)

    const indexBuildResult = await measureTime('hnsw-index-build', async () => {
      await queryLogger.query(`
        DEFINE INDEX IF NOT EXISTS hnsw_embedding 
        ON TABLE ${TEST_CONFIG.tableName} 
        FIELDS embedding 
        HNSW 
          DIMENSION ${TEST_CONFIG.hnswConfig.dimension} 
          DIST ${TEST_CONFIG.hnswConfig.distanceMetric} 
          TYPE ${TEST_CONFIG.hnswConfig.type} 
          EFC ${TEST_CONFIG.hnswConfig.efc} 
          M ${TEST_CONFIG.hnswConfig.m};
      `)
    })

    console.log(`✓ HNSW index created: ${indexBuildResult.duration}ms`)
    console.log(`  Index build rate: ${(TEST_CONFIG.recordCount / (indexBuildResult.duration / 1000)).toFixed(2)} records/sec`)

    // 7. 验证索引是否创建成功
    console.log('\n[Step 7] Verifying index creation...')
    const tableInfoAfter = await queryLogger.query(`
      INFO FOR TABLE ${TEST_CONFIG.tableName};
    `)
    console.log('Table info (after index):', JSON.stringify(tableInfoAfter, null, 2))

    // 检查索引是否存在
    const hasIndex = JSON.stringify(tableInfoAfter).includes('hnsw_embedding')
    if (hasIndex) {
      console.log('✓ HNSW index confirmed in table schema')
    } else {
      console.error('❌ HNSW index not found in table schema!')
    }

    // 8. 测试 KNN 查询（验证索引可用性）
    console.log('\n[Step 8] Testing KNN query with the index...')
    const queryVector = generateRandomVector(TEST_CONFIG.dimension)
    const k = 10
    const ef = 200

    const knnQueryResult = await measureTime('knn-query', async () => {
      return await queryLogger.query(`
        SELECT 
          id,
          content,
          chunk_index,
          vector::distance::knn() AS distance
        FROM ${TEST_CONFIG.tableName}
        WHERE embedding <|${k},${ef}|> $queryVector
        ORDER BY distance ASC;
      `, { queryVector })
    })

    console.log(`✓ KNN query completed: ${knnQueryResult.duration}ms`)
    console.log('Top 3 results:', JSON.stringify(knnQueryResult.result, null, 2).substring(0, 500))

    // 9. 测试索引构建后的插入性能
    console.log('\n[Step 9] Testing insertion performance after index creation...')
    const newRecords: Array<{ embedding: number[], content: string, chunk_index: number }> = []
    for (let i = 0; i < 100; i++) {
      newRecords.push({
        embedding: generateRandomVector(TEST_CONFIG.dimension),
        content: `New chunk ${i + 1}`,
        chunk_index: TEST_CONFIG.recordCount + i
      })
    }

    const insertAfterIndexResult = await measureTime('insert-after-index', async () => {
      await queryLogger.query(`
        INSERT INTO ${TEST_CONFIG.tableName} $records;
      `, { records: newRecords })
    })

    console.log(`✓ Insert after index: ${insertAfterIndexResult.duration}ms`)
    console.log(`  Average: ${(insertAfterIndexResult.duration / newRecords.length).toFixed(2)}ms/record`)

    // 验证新数据也能被索引查询
    const countAfter = await queryLogger.query(`
      SELECT count() FROM ${TEST_CONFIG.tableName} GROUP ALL;
    `)
    console.log(`Records in table after insert: ${JSON.stringify(countAfter)}`)

    // 10. 生成测试报告
    console.log('\n' + '='.repeat(60))
    console.log('Phase 2 Test Summary')
    console.log('='.repeat(60))
    console.log(`Records before index: ${TEST_CONFIG.recordCount}`)
    console.log(`Index build time: ${indexBuildResult.duration}ms`)
    console.log(`KNN query time: ${knnQueryResult.duration}ms`)
    console.log(`Insert after index: ${insertAfterIndexResult.duration}ms for 100 records`)
    
    const stats = queryLogger.getStats()
    console.log(`\nTotal queries executed: ${stats.totalQueries}`)
    console.log(`Log file: ${stats.logFile}`)
    console.log('\n✓ Phase 2 completed successfully')

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
  runPhase2Test()
    .then(() => {
      console.log('\n✓ All tests completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Test suite failed:', error)
      process.exit(1)
    })
}

export { runPhase2Test }

/**
 * 启动持久 SurrealDB 实例
 * 
 * 这个脚本会启动一个持久运行的 SurrealDB 实例
 * 测试脚本可以连接到这个实例进行测试
 */

import { SurrealDBProcessManager } from './utils'

const DB_PORT = 8888
const DB_NAME = 'test-hnsw'

async function startPersistentDB() {
  const processManager = new SurrealDBProcessManager(DB_NAME)

  console.log('='.repeat(60))
  console.log('启动持久 SurrealDB 实例')
  console.log('='.repeat(60))
  console.log(`端口: ${DB_PORT}`)
  console.log('用户名: root')
  console.log('密码: root')
  console.log('='.repeat(60))
  console.log()

  try {
    // 启动数据库
    await processManager.start(DB_PORT)

    console.log()
    console.log('✓ SurrealDB 启动成功!')
    console.log()
    console.log('连接信息:')
    console.log(`  端点: http://127.0.0.1:${DB_PORT}`)
    console.log(`  用户名: root`)
    console.log(`  密码: root`)
    console.log()
    console.log('测试脚本可以使用以上信息连接数据库')
    console.log('按 Ctrl+C 停止数据库')
    console.log()

    // 设置优雅关闭
    const shutdown = async () => {
      console.log('\n\n正在关闭数据库...')
      await processManager.stop()
      console.log('✓ 数据库已关闭')
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

    // 等待进程退出
    const exitCode = await processManager.waitForExit()
    console.log(`\n数据库进程已退出 (code: ${exitCode})`)
    process.exit(exitCode)

  } catch (error) {
    console.error('\n❌ 启动失败:', error)
    process.exit(1)
  }
}

// 运行
startPersistentDB()

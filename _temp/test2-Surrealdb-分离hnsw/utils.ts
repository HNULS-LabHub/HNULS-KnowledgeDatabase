import { spawn, ChildProcess } from 'child_process'
import Surreal from 'surrealdb'
import * as fs from 'fs'
import * as path from 'path'

const SURREAL_PATH = path.resolve(__dirname, '../../KnowledgeDatabase-src/vendor/surrealdb/surreal-v2.4.0.windows-amd64.exe')
const LOG_DIR = path.join(__dirname, 'results')

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

/**
 * SurrealDB 查询工具类
 * 所有查询细节和结果都会输出到日志
 */
export class SurrealDBQueryLogger {
  private db: Surreal
  private logFile: string
  private queryCount = 0

  constructor(logFileName: string = 'query-log.json') {
    this.db = new Surreal()
    this.logFile = path.join(LOG_DIR, logFileName)
    this.initLogFile()
  }

  private initLogFile(): void {
    const header = {
      timestamp: new Date().toISOString(),
      message: 'SurrealDB Query Logger initialized',
      logFile: this.logFile
    }
    this.writeLog(header)
  }

  private writeLog(data: any): void {
    const logEntry = {
      ...data,
      timestamp: data.timestamp || new Date().toISOString()
    }
    
    // 写入到文件（追加模式）
    fs.appendFileSync(this.logFile, JSON.stringify(logEntry, null, 2) + ',\n')
    
    // 同时输出到控制台
    console.log(`[${logEntry.timestamp}]`, JSON.stringify(data, null, 2))
  }

  /**
   * 连接到 SurrealDB
   */
  async connect(endpoint: string, namespace: string, database: string, username: string = 'root', password: string = 'root'): Promise<void> {
    this.writeLog({
      action: 'connect',
      endpoint,
      namespace,
      database,
      username
    })

    try {
      await this.db.connect(endpoint)
      
      // 认证
      await this.db.signin({
        username,
        password
      })
      
      await this.db.use({ namespace, database })
      
      this.writeLog({
        action: 'connect',
        status: 'success',
        endpoint,
        namespace,
        database,
        authenticated: true
      })
    } catch (error) {
      this.writeLog({
        action: 'connect',
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      throw error
    }
  }

  /**
   * 执行查询（只记录失败的查询）
   */
  async query<T extends unknown[] = any[]>(sql: string, params?: Record<string, any>): Promise<T> {
    this.queryCount++
    const queryId = `query_${this.queryCount}_${Date.now()}`
    const startTime = Date.now()

    try {
      const result = await this.db.query<T>(sql, params)
      const duration = Date.now() - startTime

      // 成功的查询只输出到控制台，不记录到文件
      console.log(`[Query ${this.queryCount}] Success (${duration}ms)`)

      return result
    } catch (error) {
      const duration = Date.now() - startTime

      // 失败的查询记录详细信息
      this.writeLog({
        queryId,
        action: 'query_error',
        sql,
        params: params || null,
        duration_ms: duration,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })

      throw error
    }
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    this.writeLog({
      action: 'close',
      totalQueries: this.queryCount
    })

    try {
      await this.db.close()
      this.writeLog({
        action: 'close',
        status: 'success'
      })
    } catch (error) {
      this.writeLog({
        action: 'close',
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * 获取查询统计
   */
  getStats() {
    return {
      totalQueries: this.queryCount,
      logFile: this.logFile
    }
  }
}

/**
 * SurrealDB 进程管理器
 */
export class SurrealDBProcessManager {
  private process: ChildProcess | null = null
  private dataDir: string
  private logFile: string

  constructor(testName: string) {
    this.dataDir = path.join(LOG_DIR, `surreal-data-${testName}`)
    this.logFile = path.join(LOG_DIR, `surreal-process-${testName}.log`)
    
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true })
    }
  }

  /**
   * 启动 SurrealDB 进程（持久运行）
   */
  async start(port: number = 8000): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[SurrealDB] Starting on port ${port}...`)
      console.log(`[SurrealDB] Executable: ${SURREAL_PATH}`)
      console.log(`[SurrealDB] Data dir: ${this.dataDir}`)

      const args = [
        'start',
        '--log', 'trace',
        '--user', 'root',
        '--pass', 'root',
        '--bind', `0.0.0.0:${port}`,
        `file://${this.dataDir}`
      ]

      console.log(`[SurrealDB] Command: ${SURREAL_PATH} ${args.join(' ')}`)

      this.process = spawn(SURREAL_PATH, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false // 保持为子进程，方便管理
      })

      const logStream = fs.createWriteStream(this.logFile, { flags: 'a' })
      let isReady = false

      this.process.stdout?.on('data', (data) => {
        const message = data.toString()
        logStream.write(`[STDOUT] ${message}`)
        console.log(`[SurrealDB] ${message.trim()}`)
        
        // 检测启动完成标志
        if (message.includes('Started web server') || message.includes('listening on')) {
          isReady = true
        }
      })

      this.process.stderr?.on('data', (data) => {
        const message = data.toString()
        logStream.write(`[STDERR] ${message}`)
        console.log(`[SurrealDB] ${message.trim()}`)
      })

      this.process.on('error', (error) => {
        console.error(`[SurrealDB] Process error:`, error)
        logStream.end()
        reject(error)
      })

      this.process.on('exit', (code) => {
        console.log(`[SurrealDB] Process exited with code ${code}`)
        logStream.end()
      })

      // 等待启动就绪（增加等待时间和端口检测）
      const checkInterval = setInterval(async () => {
        try {
          // 尝试连接端口检测是否就绪
          const net = require('net')
          const socket = new net.Socket()
          socket.setTimeout(1000)
          
          socket.on('connect', () => {
            socket.destroy()
            clearInterval(checkInterval)
            console.log(`[SurrealDB] Started successfully and ready on port ${port}`)
            resolve()
          })
          
          socket.on('error', () => {
            socket.destroy()
          })
          
          socket.connect(port, '127.0.0.1')
        } catch (error) {
          // 继续等待
        }
      }, 500)

      // 超时保护
      setTimeout(() => {
        clearInterval(checkInterval)
        if (this.process && !this.process.killed) {
          console.log(`[SurrealDB] Timeout reached, assuming ready`)
          resolve()
        } else {
          reject(new Error('SurrealDB process failed to start within timeout'))
        }
      }, 10000)
    })
  }

  /**
   * 检查进程是否运行
   */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed
  }

  /**
   * 等待进程（阻塞，直到进程退出）
   */
  async waitForExit(): Promise<number> {
    return new Promise((resolve) => {
      if (!this.process || this.process.killed) {
        resolve(0)
        return
      }
      
      this.process.on('exit', (code) => {
        resolve(code || 0)
      })
    })
  }

  /**
   * 停止 SurrealDB 进程
   */
  async stop(): Promise<void> {
    if (this.process && !this.process.killed) {
      console.log(`[SurrealDB] Stopping process...`)
      this.process.kill('SIGTERM')
      
      return new Promise((resolve) => {
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            console.log(`[SurrealDB] Force killing process...`)
            this.process.kill('SIGKILL')
          }
          resolve()
        }, 2000)
      })
    }
  }

  /**
   * 清理数据目录
   */
  cleanDataDir(): void {
    if (fs.existsSync(this.dataDir)) {
      fs.rmSync(this.dataDir, { recursive: true, force: true })
      console.log(`[SurrealDB] Data directory cleaned: ${this.dataDir}`)
    }
  }
}

/**
 * 生成随机向量
 */
export function generateRandomVector(dimension: number): number[] {
  const vector: number[] = []
  for (let i = 0; i < dimension; i++) {
    vector.push(Math.random() * 2 - 1) // [-1, 1] 范围
  }
  return vector
}

/**
 * 生成测试数据
 */
export function generateTestData(count: number, dimension: number): Array<{ embedding: number[], content: string }> {
  const data: Array<{ embedding: number[], content: string }> = []
  for (let i = 0; i < count; i++) {
    data.push({
      embedding: generateRandomVector(dimension),
      content: `Test chunk ${i + 1}`
    })
  }
  return data
}

/**
 * 测量执行时间
 */
export async function measureTime<T>(name: string, fn: () => Promise<T>): Promise<{ result: T, duration: number }> {
  console.log(`[Measure] Starting: ${name}`)
  const start = Date.now()
  const result = await fn()
  const duration = Date.now() - start
  console.log(`[Measure] Completed: ${name} (${duration}ms)`)
  return { result, duration }
}

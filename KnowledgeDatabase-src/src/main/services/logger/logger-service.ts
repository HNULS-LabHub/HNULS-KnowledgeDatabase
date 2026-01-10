import log from 'electron-log'

/**
 * 日志服务 - 基于 electron-log
 *
 * 功能：
 * - 同时输出到 Electron 控制台和 AppData 日志文件
 * - 通过环境变量 LOG_LEVEL 控制日志级别
 * - 单例模式，全局访问
 *
 * 日志文件位置：
 * - Windows: %APPDATA%\{app name}\logs\main.log
 * - macOS: ~/Library/Logs/{app name}/main.log
 * - Linux: ~/.config/{app name}/logs/main.log
 */
export class LoggerService {
  private static instance: LoggerService

  private constructor() {
    this.configure()
  }

  /**
   * 获取 LoggerService 单例实例
   */
  static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService()
    }
    return LoggerService.instance
  }

  /**
   * 配置日志服务
   */
  private configure(): void {
    // 从环境变量读取日志级别（默认 info）
    const logLevel = (process.env.LOG_LEVEL || 'info') as log.LogLevel

    // 配置控制台输出（Electron DevTools 控制台）
    log.transports.console.level = logLevel
    log.transports.console.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}'

    // 配置文件输出（AppData 目录）
    log.transports.file.level = logLevel
    log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}'
    log.transports.file.maxSize = 10 * 1024 * 1024 // 10MB 自动轮转

    // 捕获未处理的异常和 Promise 拒绝
    log.catchErrors({
      showDialog: false,
      onError: (error) => {
        this.error('Uncaught exception', error)
      }
    })

    this.info(`Logger initialized with level: ${logLevel}`)
    this.debug(`Log file: ${this.getLogPath()}`)
  }

  /**
   * 记录调试级别日志
   */
  debug(message: string, ...args: unknown[]): void {
    log.debug(message, ...args)
  }

  /**
   * 记录信息级别日志
   */
  info(message: string, ...args: unknown[]): void {
    log.info(message, ...args)
  }

  /**
   * 记录警告级别日志
   */
  warn(message: string, ...args: unknown[]): void {
    log.warn(message, ...args)
  }

  /**
   * 记录错误级别日志
   */
  error(message: string, error?: Error | unknown, ...args: unknown[]): void {
    if (error) {
      log.error(message, error, ...args)
    } else {
      log.error(message, ...args)
    }
  }

  /**
   * 动态调整日志级别
   */
  setLevel(level: log.LogLevel): void {
    log.transports.console.level = level
    log.transports.file.level = level
    this.info(`Log level changed to: ${level}`)
  }

  /**
   * 获取日志文件路径
   */
  getLogPath(): string {
    return log.transports.file.getFile()?.path || ''
  }
}

// 导出单例实例
export const logger = LoggerService.getInstance()

import * as fs from 'fs';
import * as path from 'path';
import { ChildProcess, spawn } from 'child_process';
import { 
  ISurrealDBService, 
  ServerStatus, 
  ServerEvent, 
  EventHandler 
} from './types';
import { 
  SurrealDBConfig, 
  DEFAULT_CONFIG, 
  loadConfigFromEnv, 
  mergeConfig, 
  validateConfig 
} from './config';
import { PortManager } from './port-manager';
import { SchemaManager } from './schema-manager';
import { HookSystem } from './hook-system';
import { ErrorHandler } from './error-handler';
import { QueryService } from './query-service';
import { logger } from '../logger';

/**
 * SurrealDB 服务核心类
 * 
 * 管理 SurrealDB 服务器进程的完整生命周期：
 * - 启动和关闭
 * - 端口管理
 * - Schema 初始化
 * - 事件发布
 * - 错误处理
 */
export class SurrealDBService implements ISurrealDBService {
  private process: ChildProcess | null = null;
  private status: ServerStatus = ServerStatus.STOPPED;
  private config: SurrealDBConfig;
  private portManager: PortManager;
  private schemaManager: SchemaManager;
  private hookSystem: HookSystem;
  private queryService!: QueryService;
  private startTime: number = 0;

  constructor(config?: Partial<SurrealDBConfig>) {
    // 合并配置：默认配置 + 环境变量 + 用户配置
    const envConfig = loadConfigFromEnv();
    this.config = mergeConfig(DEFAULT_CONFIG, { ...envConfig, ...config });
    
    // 验证配置
    validateConfig(this.config);

    // 初始化组件
    this.portManager = new PortManager(this.config.portRange);
    this.hookSystem = new HookSystem();
    this.schemaManager = new SchemaManager(
      this.getSurrealExePath(),
      this.hookSystem
    );
    this.queryService = new QueryService();

    logger.info('SurrealDBService created with config', {
      namespace: this.config.namespace,
      database: this.config.database,
      portRange: this.config.portRange
    });

    // 设置信号处理器
    this.setupSignalHandlers();
  }

  /**
   * 获取 SurrealDB 可执行文件路径
   */
  private getSurrealExePath(): string {
    const isDev = process.env.NODE_ENV !== 'production';
    const basePath = isDev 
      ? path.join(process.cwd(), 'vendor')
      : path.join(process.resourcesPath, 'vendor');
    
    return path.join(basePath, 'surrealdb', 'surreal-v2.4.0.windows-amd64.exe');
  }

  /**
   * 获取服务器 URL
   */
  getServerUrl(): string {
    return `http://127.0.0.1:${this.config.port}`;
  }

  /**
   * 获取认证凭据
   */
  getCredentials(): { username: string; password: string } {
    return {
      username: this.config.username,
      password: this.config.password
    };
  }

  /**
   * 检查服务器是否正在运行
   */
  isRunning(): boolean {
    return this.status === ServerStatus.READY;
  }

  /**
   * 获取当前服务器状态
   */
  getStatus(): ServerStatus {
    return this.status;
  }

  /**
   * 注册事件监听器
   */
  on(event: ServerEvent, handler: EventHandler): void {
    this.hookSystem.on(event, handler);
  }

  /**
   * 移除事件监听器
   */
  off(event: ServerEvent, handler: EventHandler): void {
    this.hookSystem.off(event, handler);
  }

  /**
   * 获取服务运行时间（毫秒）
   */
  getUptime(): number {
    return this.startTime > 0 ? Date.now() - this.startTime : 0;
  }

  /**
   * 获取进程信息
   */
  getProcessInfo(): { pid?: number; uptime: number; status: ServerStatus } {
    return {
      pid: this.process?.pid,
      uptime: this.getUptime(),
      status: this.status
    };
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    logger.info('Initializing SurrealDB service');

    // 1. 验证 surreal.exe 是否存在
    const exePath = this.getSurrealExePath();
    if (!fs.existsSync(exePath)) {
      throw ErrorHandler.createFileNotFoundError(exePath);
    }

    // 2. 分配端口（包含清理逻辑）
    try {
      this.config.port = await this.portManager.allocatePort();
      logger.info(`SurrealDB service initialized on port ${this.config.port}`);
    } catch (error) {
      throw ErrorHandler.createPortAllocationError(this.config.portRange);
    }
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    if (this.status !== ServerStatus.STOPPED) {
      throw new Error(`Cannot start server in ${this.status} state`);
    }

    this.status = ServerStatus.STARTING;
    this.startTime = Date.now();
    this.hookSystem.emit('server:starting', { port: this.config.port });

    try {
      // 1. 启动服务器进程
      await this.startServerProcess();

      // 2. 等待服务器就绪
      await this.waitForServerReady();

      // 3. 初始化或验证模式
      await this.schemaManager.initializeSchema(this.getServerUrl(), this.config);

      this.status = ServerStatus.READY;
      this.hookSystem.emit('server:ready', {
        url: this.getServerUrl(),
        port: this.config.port
      });

      logger.info('SurrealDB server is ready');

      // 连接 QueryService
      try {
        await this.queryService.connect(this.getServerUrl(), this.config);
        logger.info('QueryService initialized');
      } catch (error) {
        logger.error('Failed to initialize QueryService', error);
        // 不抛出错误，允许服务器继续运行
      }
    } catch (error) {
      this.status = ServerStatus.ERROR;
      await this.cleanup();
      ErrorHandler.handleStartupError(error as Error);
    }
  }

  /**
   * 构建启动参数
   */
  private buildStartArgs(): string[] {
    const { port, username, password, dbPath, logLevel } = this.config;

    return [
      'start',
      `surrealkv:${dbPath}`, // 使用 SurrealKV 后端
      '--bind', `127.0.0.1:${port}`,
      '--user', username,
      '--pass', password,
      '--log', logLevel,
      '--no-banner'
    ];
  }
  /**
   * 启动服务器进程
   */
  private async startServerProcess(): Promise<void> {
    const exePath = this.getSurrealExePath();
    const args = this.buildStartArgs();

    logger.debug(`Starting SurrealDB: ${exePath} ${args.join(' ')}`);

    this.process = spawn(exePath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false, // 确保子进程与父进程生命周期绑定
      windowsHide: true
    });

    // 监听进程输出
    this.process.stdout?.on('data', (data) => {
      const output = data.toString();
      logger.debug(`[SurrealDB stdout] ${output.trim()}`);
      this.hookSystem.emit('server:stdout', { output });
    });

    this.process.stderr?.on('data', (data) => {
      const output = data.toString();
      logger.warn(`[SurrealDB stderr] ${output.trim()}`);
      this.hookSystem.emit('server:stderr', { output });
    });

    // 监听进程退出
    this.process.on('exit', (code, signal) => {
      logger.info(`SurrealDB process exited with code ${code}, signal ${signal}`);
      if (this.status === ServerStatus.READY) {
        this.status = ServerStatus.ERROR;
        ErrorHandler.handleProcessCrash(code, signal, this.hookSystem);
      }
    });

    this.process.on('error', (error) => {
      logger.error('SurrealDB process error', error);
      ErrorHandler.handleRuntimeError(error, this.hookSystem, 'process error');
    });
  }

  /**
   * 等待服务器就绪
   */
  private async waitForServerReady(timeout = 30000): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 500;

    while (Date.now() - startTime < timeout) {
      try {
        const isReady = await this.checkServerReady();
        if (isReady) return;
      } catch (error) {
        // 继续等待
      }
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    throw ErrorHandler.createTimeoutError('Server startup', timeout);
  }

  /**
   * 检查服务器是否就绪
   */
  private async checkServerReady(): Promise<boolean> {
    const exePath = this.getSurrealExePath();

    return new Promise((resolve) => {
      const proc = spawn(exePath, [
        'is-ready',
        '--endpoint', this.getServerUrl()
      ]);

      proc.on('exit', (code) => {
        resolve(code === 0);
      });

      proc.on('error', () => {
        resolve(false);
      });
    });
  }
  /**
   * 关闭服务器
   */
  async shutdown(): Promise<void> {
    if (!this.process || this.status === ServerStatus.STOPPED) {
      return;
    }

    this.status = ServerStatus.SHUTTING_DOWN;
    this.hookSystem.emit('server:shutdown', {});
    logger.info('Shutting down SurrealDB server');

    // 断开 QueryService
    try {
      await this.queryService.disconnect();
    } catch (error) {
      logger.error('Error disconnecting QueryService', error);
    }

    try {
      // 1. 发送 SIGINT 信号（优雅关闭）
      this.process.kill('SIGINT');

      // 2. 等待进程退出（最多 5 秒）
      const exited = await this.waitForProcessExit(5000);

      // 3. 如果未退出，强制终止
      if (!exited && this.process && !this.process.killed) {
        logger.warn('Force killing SurrealDB process');
        this.process.kill('SIGKILL');
        await this.waitForProcessExit(2000);
      }
    } catch (error) {
      ErrorHandler.handleShutdownError(error as Error, this.process);
    } finally {
      await this.cleanup();
    }
  }

  /**
   * 等待进程退出
   */
  private async waitForProcessExit(timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.process) {
        resolve(true);
        return;
      }

      const timer = setTimeout(() => {
        resolve(false);
      }, timeout);

      this.process.once('exit', () => {
        clearTimeout(timer);
        resolve(true);
      });
    });
  }

  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    this.process = null;
    this.status = ServerStatus.STOPPED;
    this.startTime = 0;
    await this.portManager.releasePort();
    logger.info('SurrealDB service cleanup completed');
  }

  /**
   * 获取查询服务
   */
  getQueryService(): QueryService {
    return this.queryService;
  }

  /**
   * 设置信号处理器
   */
  private setupSignalHandlers(): void {
    // 监听进程退出信号
    process.on('SIGINT', () => {
      logger.info('Received SIGINT, shutting down SurrealDB service...');
      this.shutdown().then(() => process.exit(0));
    });

    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, shutting down SurrealDB service...');
      this.shutdown().then(() => process.exit(0));
    });

    // Windows 特定处理
    if (process.platform === 'win32') {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.on('SIGINT', () => {
        process.emit('SIGINT' as any);
      });
    }
  }
}
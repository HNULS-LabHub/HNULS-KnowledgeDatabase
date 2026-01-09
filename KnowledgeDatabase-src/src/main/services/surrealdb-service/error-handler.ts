import { ChildProcess } from 'child_process';
import { logger } from '../logger';
import { HookSystem } from './hook-system';

/**
 * 错误处理器
 * 
 * 统一处理 SurrealDB 服务的各种错误场景：
 * - 启动错误
 * - 运行时错误
 * - 关闭错误
 */
export class ErrorHandler {
  /**
   * 处理启动错误
   */
  static handleStartupError(error: Error, cleanup?: () => Promise<void>): never {
    logger.error('SurrealDB startup error', error);
    
    // 尝试清理资源
    if (cleanup) {
      cleanup().catch((cleanupError) => {
        logger.error('Cleanup failed during startup error', cleanupError);
      });
    }
    
    throw error;
  }

  /**
   * 处理运行时错误
   */
  static handleRuntimeError(
    error: Error, 
    hookSystem: HookSystem,
    context?: string
  ): void {
    const contextMsg = context ? ` (${context})` : '';
    logger.error(`SurrealDB runtime error${contextMsg}`, error);
    
    // 发出错误事件，但不抛出异常（允许应用继续运行）
    hookSystem.emit('server:error', { error });
  }

  /**
   * 处理关闭错误
   */
  static handleShutdownError(
    error: Error, 
    process?: ChildProcess | null
  ): void {
    logger.error('SurrealDB shutdown error', error);
    
    // 强制清理进程
    if (process && !process.killed) {
      try {
        process.kill('SIGKILL');
        logger.warn('Force killed SurrealDB process due to shutdown error');
      } catch (killError) {
        logger.error('Failed to force kill process', killError);
      }
    }
  }

  /**
   * 处理超时错误
   */
  static createTimeoutError(operation: string, timeout: number): Error {
    return new Error(`${operation} timed out after ${timeout}ms`);
  }

  /**
   * 处理文件不存在错误
   */
  static createFileNotFoundError(filePath: string): Error {
    return new Error(`SurrealDB executable not found at: ${filePath}`);
  }

  /**
   * 处理端口分配错误
   */
  static createPortAllocationError(portRange: { min: number; max: number }): Error {
    return new Error(
      `No available port in range ${portRange.min}-${portRange.max}. ` +
      'Please check if other applications are using these ports.'
    );
  }

  /**
   * 处理配置验证错误
   */
  static createConfigValidationError(message: string): Error {
    return new Error(`Configuration validation failed: ${message}`);
  }

  /**
   * 处理进程崩溃
   */
  static handleProcessCrash(
    code: number | null, 
    signal: string | null,
    hookSystem: HookSystem
  ): void {
    const crashInfo = signal 
      ? `killed by signal ${signal}` 
      : `exited with code ${code}`;
    
    const error = new Error(`SurrealDB process crashed: ${crashInfo}`);
    logger.error('SurrealDB process crashed', error);
    
    hookSystem.emit('server:error', { error });
  }
}
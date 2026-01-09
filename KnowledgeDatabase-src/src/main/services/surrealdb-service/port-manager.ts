import * as net from 'net';
import { spawn } from 'child_process';
import { PortRange } from './types';
import { logger } from '../logger';

/**
 * 端口管理器
 * 
 * 功能：
 * - 分配可用端口（默认 8000，范围 8000-8100）
 * - 检测端口占用情况
 * - 清理残余进程
 * - 处理 TIME_WAIT 状态
 */
export class PortManager {
  private allocatedPort: number | null = null;
  private portRange: PortRange;

  constructor(portRange: PortRange = { min: 8000, max: 8100 }) {
    this.portRange = portRange;
  }

  /**
   * 分配可用端口
   */
  async allocatePort(): Promise<number> {
    const { min, max } = this.portRange;

    // 1. 尝试默认端口
    if (await this.tryAllocatePort(min)) {
      return min;
    }

    // 2. 在范围内查找可用端口
    for (let port = min + 1; port <= max; port++) {
      if (await this.tryAllocatePort(port)) {
        return port;
      }
    }

    throw new Error(`No available port in range ${min}-${max}`);
  }

  /**
   * 尝试分配指定端口
   */
  private async tryAllocatePort(port: number): Promise<boolean> {
    // 1. 检查端口是否可用
    const available = await this.isPortAvailable(port);
    if (available) {
      this.allocatedPort = port;
      logger.info(`Port ${port} allocated successfully`);
      return true;
    }

    // 2. 端口被占用，尝试清理
    logger.warn(`Port ${port} is occupied, attempting to clean up`);
    const pid = await this.findProcessOnPort(port);
    
    if (pid) {
      const isSurrealDB = await this.isSurrealDBProcess(pid);
      if (isSurrealDB) {
        logger.info(`Found SurrealDB process (PID: ${pid}) on port ${port}, killing it`);
        await this.killProcess(pid);

        // 3. 等待端口释放（处理 TIME_WAIT）
        const released = await this.waitForPortRelease(port, 2000);
        if (released) {
          this.allocatedPort = port;
          logger.info(`Port ${port} released and allocated successfully`);
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 检查端口是否可用
   */
  async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.once('error', () => {
        resolve(false);
      });

      server.once('listening', () => {
        server.close();
        resolve(true);
      });

      server.listen(port, '127.0.0.1');
    });
  }

  /**
   * 查找占用指定端口的进程 PID (Windows)
   */
  async findProcessOnPort(port: number): Promise<number | null> {
    return new Promise((resolve) => {
      const proc = spawn('netstat', ['-ano']);
      let output = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', () => {
        const lines = output.split('\n');
        for (const line of lines) {
          if (line.includes(`:${port}`) && line.includes('LISTENING')) {
            const parts = line.trim().split(/\s+/);
            const pid = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(pid)) {
              resolve(pid);
              return;
            }
          }
        }
        resolve(null);
      });

      proc.on('error', () => resolve(null));
    });
  }


  /**
   * 检查进程是否是 SurrealDB 进程 (Windows)
   */
  async isSurrealDBProcess(pid: number): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV']);
      let output = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', () => {
        resolve(output.toLowerCase().includes('surreal'));
      });

      proc.on('error', () => resolve(false));
    });
  }

  /**
   * 强制终止进程 (Windows)
   */
  async killProcess(pid: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('taskkill', ['/F', '/PID', pid.toString()]);

      proc.on('close', (code) => {
        if (code === 0) {
          logger.info(`Process ${pid} killed successfully`);
          resolve();
        } else {
          reject(new Error(`Failed to kill process ${pid}`));
        }
      });

      proc.on('error', reject);
    });
  }

  /**
   * 等待端口释放（处理 TIME_WAIT 状态）
   */
  async waitForPortRelease(port: number, timeout: number): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 200;

    while (Date.now() - startTime < timeout) {
      if (await this.isPortAvailable(port)) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    return false;
  }

  /**
   * 释放已分配的端口
   */
  async releasePort(): Promise<void> {
    if (this.allocatedPort) {
      logger.info(`Releasing port ${this.allocatedPort}`);
      this.allocatedPort = null;
    }
  }

  /**
   * 获取已分配的端口
   */
  getAllocatedPort(): number | null {
    return this.allocatedPort;
  }
}

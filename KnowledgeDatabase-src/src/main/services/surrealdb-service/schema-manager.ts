import { spawn } from 'child_process';
import { SurrealDBConfig } from './config';
import { HookSystem } from './hook-system';
import { logger } from '../logger';
import { schemas } from './schema';

/**
 * Schema 管理器
 * 
 * 功能：
 * - 检查数据库模式是否存在
 * - 从 TypeScript 模块导入模式
 * - 验证模式与模板的一致性
 */
export class SchemaManager {
  private exePath: string;

  constructor(
    exePath: string,
    private hookSystem: HookSystem
  ) {
    this.exePath = exePath;
  }

  /**
   * 初始化数据库模式
   */
  async initializeSchema(serverUrl: string, config: SurrealDBConfig): Promise<void> {
    logger.info('Initializing database schema');

    // 1. 检查模式是否存在
    const schemaExists = await this.checkSchemaExists(serverUrl, config);

    if (!schemaExists) {
      // 2. 导入模式
      await this.importSchema(serverUrl, config);
      this.hookSystem.emit('schema:initialized', {});
    } else {
      // 3. 验证模式
      const isValid = await this.validateSchema(serverUrl, config);
      this.hookSystem.emit('schema:validated', { isValid });

      if (!isValid) {
        // 4. 模式不一致时重新导入
        logger.warn('Schema mismatch detected, re-importing schema');
        await this.importSchema(serverUrl, config);
        this.hookSystem.emit('schema:overwritten', {});
      }
    }
  }


  /**
   * 检查模式是否存在
   */
  private async checkSchemaExists(
    serverUrl: string,
    config: SurrealDBConfig
  ): Promise<boolean> {
    try {
      // 查询是否有表定义
      const result = await this.executeQuery(
        'INFO FOR DB;',
        serverUrl,
        config
      );
      // 如果返回结果包含表信息，说明模式存在
      return result.includes('tables');
    } catch {
      return false;
    }
  }

  /**
   * 导入模式
   */
  async importSchema(serverUrl: string, config: SurrealDBConfig): Promise<void> {
    const schemaDefinitions = this.getSchemaDefinitions();

    if (schemaDefinitions.length === 0) {
      logger.warn('No schema definitions found');
      return;
    }

    logger.info(`Importing ${schemaDefinitions.length} schema definitions`);

    for (const schemaSql of schemaDefinitions) {
      await this.executeSchema(schemaSql, serverUrl, config);
    }

    logger.info('Schema import completed');
  }

  /**
   * 获取 schema 定义
   */
  private getSchemaDefinitions(): string[] {
    return schemas;
  }

  /**
   * 执行 schema SQL
   */
  private async executeSchema(
    schemaSql: string,
    serverUrl: string,
    config: SurrealDBConfig
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        'sql',
        '--endpoint', serverUrl,
        '--namespace', config.namespace,
        '--database', config.database,
        '--user', config.username,
        '--pass', config.password,
        '--hide-welcome'
      ];

      logger.debug('Executing schema SQL');

      const proc = spawn(this.exePath, args);

      // 通过 stdin 传入 SQL
      proc.stdin?.write(schemaSql);
      proc.stdin?.end();

      let output = '';
      let errorOutput = '';

      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          logger.debug('Schema executed successfully');
          resolve();
        } else {
          const error = new Error(`Schema execution failed: ${errorOutput || output}`);
          logger.error('Failed to execute schema', error);
          reject(error);
        }
      });

      proc.on('error', reject);
    });
  }

  /**
   * 执行查询
   */
  private async executeQuery(
    query: string,
    serverUrl: string,
    config: SurrealDBConfig
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        'sql',
        '--endpoint', serverUrl,
        '--namespace', config.namespace,
        '--database', config.database,
        '--user', config.username,
        '--pass', config.password,
        '--hide-welcome'
      ];

      const proc = spawn(this.exePath, args);

      // 通过 stdin 传入查询
      proc.stdin?.write(query);
      proc.stdin?.end();

      let output = '';
      let errorOutput = '';

      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Query failed: ${errorOutput || output}`));
        }
      });

      proc.on('error', reject);
    });
  }

  /**
   * 验证模式
   */
  async validateSchema(serverUrl: string, config: SurrealDBConfig): Promise<boolean> {
    // 简化实现：假设模式总是有效的
    // 实际实现需要查询数据库并比较表结构
    logger.debug('Schema validation - assuming valid for now');
    return true;
  }
}
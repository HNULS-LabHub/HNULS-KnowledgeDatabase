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
    logger.debug('Checking if schema exists...');
    const schemaExists = await this.checkSchemaExists(serverUrl, config);
    logger.info(`Schema exists: ${schemaExists}`);

    if (!schemaExists) {
      // 2. 导入模式
      logger.info('Schema does not exist, importing...');
      await this.importSchema(serverUrl, config);
      this.hookSystem.emit('schema:initialized', {});
      logger.info('Schema initialization completed');
    } else {
      // 3. 验证模式
      logger.debug('Schema exists, validating...');
      const isValid = await this.validateSchema(serverUrl, config);
      this.hookSystem.emit('schema:validated', { isValid });
      logger.info(`Schema validation result: ${isValid}`);

      if (!isValid) {
        // 4. 模式不一致时重新导入
        logger.warn('Schema mismatch detected, re-importing schema');
        await this.importSchema(serverUrl, config);
        this.hookSystem.emit('schema:overwritten', {});
        logger.info('Schema re-import completed');
      } else {
        logger.info('Schema is valid, no import needed');
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
      
      logger.debug(`INFO FOR DB result: ${result.substring(0, 200)}...`);
      
      // 检查是否有具体的表定义（不是空的 tables: {}）
      // 方法1: 检查是否包含 DEFINE TABLE 关键字
      if (result.includes('DEFINE TABLE')) {
        logger.debug('Schema exists: found DEFINE TABLE statements');
        return true;
      }
      
      // 方法2: 检查特定表是否存在
      if (result.includes('TABLE user') || result.includes('TABLE document')) {
        logger.debug('Schema exists: found user or document table');
        return true;
      }
      
      // 方法3: 检查 tables 是否为空对象
      // INFO FOR DB 返回格式: tables: { user: "DEFINE TABLE...", ... }
      const tablesMatch = result.match(/tables:\s*\{([^}]*)\}/);
      if (tablesMatch && tablesMatch[1].trim().length > 0) {
        logger.debug('Schema exists: tables object is not empty');
        return true;
      }
      
      logger.debug('Schema does not exist: no tables found');
      return false;
    } catch (error) {
      logger.error('Error checking schema existence', error);
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

    for (let i = 0; i < schemaDefinitions.length; i++) {
      const schemaSql = schemaDefinitions[i];
      logger.debug(`Executing schema ${i + 1}/${schemaDefinitions.length}`);
      logger.debug(`Schema SQL preview: ${schemaSql.substring(0, 100)}...`);
      
      try {
        await this.executeSchema(schemaSql, serverUrl, config);
        logger.info(`Schema ${i + 1}/${schemaDefinitions.length} executed successfully`);
      } catch (error) {
        logger.error(`Failed to execute schema ${i + 1}/${schemaDefinitions.length}`, error);
        throw error;
      }
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

      logger.debug(`Executing schema SQL with args: ${args.join(' ')}`);

      const proc = spawn(this.exePath, args);

      // 通过 stdin 传入 SQL
      proc.stdin?.write(schemaSql);
      proc.stdin?.end();

      let output = '';
      let errorOutput = '';

      proc.stdout?.on('data', (data) => {
        const text = data.toString();
        output += text;
        logger.debug(`[Schema SQL stdout] ${text.trim()}`);
      });

      proc.stderr?.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        logger.warn(`[Schema SQL stderr] ${text.trim()}`);
      });

      proc.on('close', (code) => {
        if (code === 0) {
          logger.debug(`Schema executed successfully. Output: ${output.substring(0, 200)}`);
          resolve();
        } else {
          const error = new Error(`Schema execution failed with code ${code}: ${errorOutput || output}`);
          logger.error('Failed to execute schema', error);
          reject(error);
        }
      });

      proc.on('error', (err) => {
        logger.error('Schema process error', err);
        reject(err);
      });
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
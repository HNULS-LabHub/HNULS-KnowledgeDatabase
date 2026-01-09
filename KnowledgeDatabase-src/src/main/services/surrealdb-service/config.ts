import { PortRange } from './types';

/**
 * SurrealDB 服务配置接口
 */
export interface SurrealDBConfig {
  // 数据库配置
  dbPath: string;
  namespace: string;
  database: string;

  // 认证配置
  username: string;
  password: string;

  // 网络配置
  port: number;
  portRange: PortRange;

  // 日志配置
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'trace';
}

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: SurrealDBConfig = {
  dbPath: './data/knowledge.db',
  namespace: 'knowledge',
  database: 'main',
  username: 'root',
  password: 'root',
  port: 8000,
  portRange: { min: 8000, max: 8100 },
  logLevel: 'info'
};

/**
 * 从环境变量加载配置
 */
export function loadConfigFromEnv(): Partial<SurrealDBConfig> {
  const config: Partial<SurrealDBConfig> = {};

  if (process.env.SURREALDB_PATH) {
    config.dbPath = process.env.SURREALDB_PATH;
  }

  if (process.env.SURREALDB_NAMESPACE) {
    config.namespace = process.env.SURREALDB_NAMESPACE;
  }

  if (process.env.SURREALDB_DATABASE) {
    config.database = process.env.SURREALDB_DATABASE;
  }

  if (process.env.SURREALDB_USER) {
    config.username = process.env.SURREALDB_USER;
  }

  if (process.env.SURREALDB_PASS) {
    config.password = process.env.SURREALDB_PASS;
  }

  if (process.env.SURREALDB_PORT) {
    const port = parseInt(process.env.SURREALDB_PORT, 10);
    if (!isNaN(port)) {
      config.port = port;
    }
  }

  if (process.env.SURREALDB_LOG_LEVEL) {
    const level = process.env.SURREALDB_LOG_LEVEL as SurrealDBConfig['logLevel'];
    if (['debug', 'info', 'warn', 'error', 'trace'].includes(level)) {
      config.logLevel = level;
    }
  }

  return config;
}

/**
 * 合并配置
 */
export function mergeConfig(
  base: SurrealDBConfig,
  override?: Partial<SurrealDBConfig>
): SurrealDBConfig {
  return {
    ...base,
    ...override
  };
}

/**
 * 验证配置
 */
export function validateConfig(config: SurrealDBConfig): void {
  if (!config.dbPath) {
    throw new Error('Database path is required');
  }

  if (!config.namespace) {
    throw new Error('Namespace is required');
  }

  if (!config.database) {
    throw new Error('Database name is required');
  }

  if (!config.username || !config.password) {
    throw new Error('Username and password are required');
  }

  if (config.port < 1 || config.port > 65535) {
    throw new Error('Port must be between 1 and 65535');
  }

  if (config.portRange.min > config.portRange.max) {
    throw new Error('Port range min must be less than or equal to max');
  }
}

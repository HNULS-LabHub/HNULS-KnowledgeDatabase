/**
 * SurrealDB 服务模块导出
 */

// 主要服务类
export { SurrealDBService } from './surrealdb-service';
export { QueryService } from './query-service';

// 类型定义
export type {
  ServerStatus,
  ServerEvent,
  EventHandler,
  ISurrealDBService,
  PortRange,
  ServerStartingEvent,
  ServerReadyEvent,
  ServerErrorEvent,
  ServerOutputEvent,
  SchemaInitializedEvent,
  SchemaValidatedEvent,
  SchemaOverwrittenEvent
} from './types';

// 配置
export type { SurrealDBConfig } from './config';
export {
  DEFAULT_CONFIG,
  loadConfigFromEnv,
  mergeConfig,
  validateConfig
} from './config';

// 组件类（供高级用户使用）
export { PortManager } from './port-manager';
export { SchemaManager } from './schema-manager';
export { HookSystem } from './hook-system';
export { ErrorHandler } from './error-handler';

// Schema 定义
export { schemas, userTable, documentTable, operationLogTable } from './schema';
export type { TableDefinition } from './schema';
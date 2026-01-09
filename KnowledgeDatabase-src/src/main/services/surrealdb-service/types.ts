/**
 * SurrealDB 服务类型定义
 */

/**
 * 服务器状态枚举
 */
export enum ServerStatus {
  STOPPED = 'stopped',
  STARTING = 'starting',
  READY = 'ready',
  ERROR = 'error',
  SHUTTING_DOWN = 'shutting_down'
}

/**
 * 服务器事件类型
 */
export type ServerEvent =
  | 'server:starting'
  | 'server:ready'
  | 'server:error'
  | 'server:shutdown'
  | 'server:stdout'
  | 'server:stderr'
  | 'schema:initialized'
  | 'schema:validated'
  | 'schema:overwritten';

/**
 * 事件处理器类型
 */
export type EventHandler = (data: unknown) => void | Promise<void>;

/**
 * 服务器启动事件数据
 */
export interface ServerStartingEvent {
  port: number;
}

/**
 * 服务器就绪事件数据
 */
export interface ServerReadyEvent {
  url: string;
  port: number;
}

/**
 * 服务器错误事件数据
 */
export interface ServerErrorEvent {
  error: Error;
}


/**
 * 服务器输出事件数据
 */
export interface ServerOutputEvent {
  output: string;
}

/**
 * Schema 初始化事件数据
 */
export interface SchemaInitializedEvent {}

/**
 * Schema 验证事件数据
 */
export interface SchemaValidatedEvent {
  isValid: boolean;
}

/**
 * Schema 覆盖事件数据
 */
export interface SchemaOverwrittenEvent {}

/**
 * SurrealDB 服务接口
 */
export interface ISurrealDBService {
  // 生命周期方法
  initialize(): Promise<void>;
  start(): Promise<void>;
  shutdown(): Promise<void>;

  // 状态查询
  isRunning(): boolean;
  getStatus(): ServerStatus;

  // 配置访问
  getServerUrl(): string;
  getCredentials(): { username: string; password: string };

  // 事件订阅
  on(event: ServerEvent, handler: EventHandler): void;
  off(event: ServerEvent, handler: EventHandler): void;
}

/**
 * 端口范围配置
 */
export interface PortRange {
  min: number;
  max: number;
}

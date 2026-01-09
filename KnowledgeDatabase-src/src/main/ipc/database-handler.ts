import { IpcMainInvokeEvent } from 'electron';
import { BaseIPCHandler } from './base-handler';
import { SurrealDBService } from '../services/surrealdb-service';

/**
 * 数据库操作 IPC 处理器
 * 
 * 提供数据库 CRUD 操作和日志查询功能
 */
export class DatabaseIPCHandler extends BaseIPCHandler {
  constructor(private surrealDBService: SurrealDBService) {
    super();
    this.register();
  }

  protected getChannelPrefix(): string {
    return 'database';
  }

  // ==================== User 操作 ====================

  async handleCreateuser(_event: IpcMainInvokeEvent, data: any) {
    const queryService = this.surrealDBService.getQueryService();
    return await queryService.create('user', data);
  }

  async handleGetusers(_event: IpcMainInvokeEvent) {
    const queryService = this.surrealDBService.getQueryService();
    return await queryService.select('user');
  }

  async handleGetuser(_event: IpcMainInvokeEvent, id: string) {
    const queryService = this.surrealDBService.getQueryService();
    return await queryService.select('user', id);
  }

  async handleUpdateuser(_event: IpcMainInvokeEvent, id: string, data: any) {
    const queryService = this.surrealDBService.getQueryService();
    return await queryService.update('user', id, data);
  }

  async handleDeleteuser(_event: IpcMainInvokeEvent, id: string) {
    const queryService = this.surrealDBService.getQueryService();
    return await queryService.delete('user', id);
  }

  // ==================== Document 操作 ====================

  async handleCreatedocument(_event: IpcMainInvokeEvent, data: any) {
    const queryService = this.surrealDBService.getQueryService();
    return await queryService.create('document', data);
  }

  async handleGetdocuments(_event: IpcMainInvokeEvent) {
    const queryService = this.surrealDBService.getQueryService();
    return await queryService.select('document');
  }

  async handleGetdocument(_event: IpcMainInvokeEvent, id: string) {
    const queryService = this.surrealDBService.getQueryService();
    return await queryService.select('document', id);
  }

  async handleUpdatedocument(_event: IpcMainInvokeEvent, id: string, data: any) {
    const queryService = this.surrealDBService.getQueryService();
    return await queryService.update('document', id, data);
  }

  async handleDeletedocument(_event: IpcMainInvokeEvent, id: string) {
    const queryService = this.surrealDBService.getQueryService();
    return await queryService.delete('document', id);
  }

  // ==================== 通用查询 ====================

  async handleQuery(_event: IpcMainInvokeEvent, sql: string, params?: any) {
    const queryService = this.surrealDBService.getQueryService();
    return await queryService.query(sql, params);
  }

  // ==================== 日志查询 ====================

  async handleGetlogs(_event: IpcMainInvokeEvent, options?: any) {
    const queryService = this.surrealDBService.getQueryService();
    return await queryService.getOperationLogs(options);
  }

  async handleGetstatus(_event: IpcMainInvokeEvent) {
    return {
      connected: this.surrealDBService.getQueryService().isConnected(),
      serverRunning: this.surrealDBService.isRunning(),
      serverUrl: this.surrealDBService.getServerUrl()
    };
  }
}

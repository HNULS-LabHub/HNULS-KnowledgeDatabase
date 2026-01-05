# Main 进程服务层 (Services)

封装主进程的核心业务逻辑和系统服务。

## 服务分类

### 系统服务
- `app-service.ts` - 应用生命周期管理
- `window-service.ts` - 窗口管理服务
- `menu-service.ts` - 菜单管理服务

### 业务服务
- `file-service.ts` - 文件系统操作
- `database-service.ts` - 数据库操作
- `search-service.ts` - 搜索索引服务
- `sync-service.ts` - 数据同步服务

### 工具服务
- `logger-service.ts` - 日志服务
- `config-service.ts` - 配置管理
- `notification-service.ts` - 系统通知

## 设计原则

- 单一职责：每个服务只负责一个业务域
- 依赖注入：服务间通过构造函数注入依赖
- 异步优先：所有 I/O 操作使用 async/await
- 错误处理：统一的错误处理和日志记录

## 示例

```typescript
export class FileService {
  constructor(
    private logger: LoggerService,
    private config: ConfigService
  ) {}

  async readFile(path: string): Promise<string> {
    try {
      this.logger.info(`Reading file: ${path}`);
      return await fs.readFile(path, 'utf-8');
    } catch (error) {
      this.logger.error(`Failed to read file: ${path}`, error);
      throw error;
    }
  }
}
```
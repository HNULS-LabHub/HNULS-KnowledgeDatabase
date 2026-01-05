# Main 进程 IPC 处理器 (IPC Handlers)

处理来自渲染进程的 IPC 请求，作为服务层的接口层。

## 架构设计

```
Renderer Process  →  IPC Handler  →  Service Layer
     (请求)           (接口层)        (业务逻辑)
```

## 文件结构

- `base-handler.ts` - IPC 处理器基类
- `test-handler.ts` - 测试用 IPC 处理器
- `file-handler.ts` - 文件操作 IPC 处理器
- `database-handler.ts` - 数据库操作 IPC 处理器
- `index.ts` - 统一注册所有处理器

## 使用方式

### 1. 继承基类创建处理器

```typescript
export class FileIPCHandler extends BaseIPCHandler {
  constructor(private fileService: FileService) {
    super();
    this.register();
  }

  protected getChannelPrefix(): string {
    return 'file';
  }

  async handleRead(event: IpcMainInvokeEvent, path: string) {
    const content = await this.fileService.readFile(path);
    return { success: true, data: content };
  }
}
```

### 2. 自动注册机制

基类会自动将以 `handle` 开头的方法注册为 IPC 处理器：
- `handleRead` → `file:read`
- `handleWrite` → `file:write`
- `handleDelete` → `file:delete`

### 3. 错误处理

所有处理器都有统一的错误处理机制，返回标准格式：

```typescript
{
  success: boolean;
  data?: any;
  error?: string;
}
```

## 设计原则

- **薄接口层**：IPC 处理器只负责参数验证和格式转换
- **业务逻辑分离**：实际业务逻辑在 Service 层实现
- **统一错误处理**：所有错误都被捕获并格式化
- **类型安全**：配合 TypeScript 提供类型检查
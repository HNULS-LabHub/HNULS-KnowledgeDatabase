# 服务层 (Service)

封装服务与纯函数工具。

## 分类

### 纯函数类

- 数据格式化
- 复杂的数学计算
- 无副作用的工具函数

### 有状态的底层服务

- 某些服务可能需要持有私有状态，但不适合放入 Pinia
- 例如：`DownloaderService` 内部维护连接池或下载进度

## 示例结构

```
service/
├── downloader/        # 有状态服务
│   └── index.ts
├── parser/            # 纯函数计算服务
│   └── index.ts
└── ...
```

## 示例

```typescript
// downloader/index.ts
class DownloaderService {
  private progressMap = new Map<string, number>()

  start(url: string) {
    /* ... */
  }
  pause(id: string) {
    /* ... */
  }
  onProgress(callback: (id: string, progress: number) => void) {
    /* ... */
  }
}

export const downloaderService = new DownloaderService()
```

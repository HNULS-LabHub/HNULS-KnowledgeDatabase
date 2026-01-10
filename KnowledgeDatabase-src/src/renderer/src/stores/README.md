# 状态管理 (Stores)

Pinia Store，单一事实来源，按业务域分目录。

## 目录结构

每个业务域应包含以下四个文件：

```
stores/
└── user/
    ├── user.store.ts       # Pinia Store 定义 (State, Getters, Actions)
    ├── user.datasource.ts  # 数据源适配器 (决定调用 Mock 还是 IPC)
    ├── user.types.ts       # Store 内部私有类型
    └── user.mock.ts        # 模拟数据生成器
```

## 数据源解耦模式

在 `datasource.ts` 中通过检测环境切换数据来源，使得在没有后端的情况下也能调试前端逻辑。

```typescript
// 示例：user.datasource.ts
import * as mock from './user.mock'

const isElectron = !!(window as any).electron

export const UserDataSource = {
  async getUserProfile(id: string) {
    if (isElectron) {
      // 生产环境：调用 IPC
      return await window.electron.ipcRenderer.invoke('get_user_profile', { id })
    } else {
      // 开发环境：调用 Mock 数据
      console.debug('[Dev Mode] Using Mock Data')
      return mock.mockUserProfile(id)
    }
  }
}
```

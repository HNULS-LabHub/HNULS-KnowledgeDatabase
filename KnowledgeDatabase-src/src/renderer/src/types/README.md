# 公共类型 (Types)

全局类型定义，特别是 Vue 前端与 Electron 主进程交互的 DTO。

## 规范

- 按业务域分目录
- 存放跨业务域使用的类型
- 局部类型放在各自的 `stores/domain/types.ts` 或组件目录内
- 如果一个类型被多个解耦的业务域引用，请将其提升至此目录

## 示例结构

```
types/
├── file/
│   └── index.ts       # 文件相关类型定义
├── setting/
│   └── index.ts       # 设置相关类型定义
└── ...
```

## 示例

```typescript
// file/index.ts
export interface FileNode {
  id: string
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}
```

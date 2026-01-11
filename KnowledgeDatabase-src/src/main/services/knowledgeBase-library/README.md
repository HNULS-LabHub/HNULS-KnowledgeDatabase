# 知识库元数据服务 (Knowledge Library Service)

负责管理知识库元数据的存储和读取。

## 功能

- 读取所有知识库元数据
- 根据 ID 获取知识库元数据
- 创建新知识库
- 更新知识库元数据
- 删除知识库

## 数据存储

元数据存储在用户数据目录下的 `data/Knowledge-library-meta.json` 文件中。

文件结构：
```json
{
  "version": "1.0.0",
  "knowledgeBases": [
    {
      "id": 1,
      "name": "知识库名称",
      "description": "描述",
      "docCount": 0,
      "chunkCount": 0,
      "lastUpdated": "2025-01-11T22:00:00.000Z",
      "createdAt": "2025-01-11T22:00:00.000Z",
      "color": "#2563eb",
      "icon": "<svg>...</svg>"
    }
  ]
}
```

## 使用示例

```typescript
import { KnowledgeLibraryService } from './services/knowledgeBase-library'

const service = new KnowledgeLibraryService()

// 获取所有知识库
const allKBs = await service.getAll()

// 创建新知识库
const newKB = await service.create({
  name: '产品文档库',
  description: '包含所有产品文档',
  color: '#2563eb',
  icon: '<svg>...</svg>'
})

// 更新知识库
await service.update(1, {
  name: '更新后的名称',
  docCount: 10
})

// 删除知识库
await service.delete(1)
```

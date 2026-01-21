
## 我的理解与设计方案

### 需求理解

你希望实现一个**双层配置系统**：

1. **知识库全局配置**（SettingsView）：影响整个知识库的默认设置
2. **文档独立配置**（ParseTab抽屉）：每个文档可以覆盖全局设置

**核心逻辑**：
- 文档配置默认跟随全局配置（淡灰色显示）
- 用户手动修改后，保存独立配置（正常颜色）
- 配置存储在 `.config/KnowledgeConfig.json`

**关键假设**：
1. 分块模式使用 WhiteSelect 组件，但只提供一个选项"固定段落分块"（对应 mode: 'recursive'）
2. 配置文件结构为双层：`{ global: {...}, documents: { [fileKey]: {...} } }`
3. 输入框留空 = 跟随全局；选择器第一项 = 跟随全局
4. 修改全局配置时，所有跟随全局的文档配置自动同步

---

## 设计方案

### 1. 配置文件结构

**位置**：`{knowledgeBaseDocumentPath}/.config/KnowledgeConfig.json`

```typescript
{
  "version": "1.0.0",
  "global": {
    "chunking": {
      "mode": "recursive",  // 固定值
      "maxChars": 1000
    },
    "embedding": {
      // 预留
    },
    "knowledgeGraph": {
      // 预留
    }
  },
  "documents": {
    // 使用 fileKey（相对路径）作为标识符，与 parsing/chunking store 保持一致
    // 例如："folder/document.pdf" 或 "document.txt"
    "folder/document.pdf": {
      "chunking": {
        "maxChars": 1500  // 覆盖全局
      }
    },
    "document.txt": {
      // 完全跟随全局（不存在此key或为空对象）
    }
  }
}
```

**文档标识符说明**：
- 使用 `fileKey`（文件相对路径）作为文档唯一标识符，与现有 parsing/chunking store 保持一致
- fileKey 格式：相对于知识库文档根目录的路径，如 "folder/file.pdf" 或 "file.txt"

**配置清理机制**：
在文件删除时自动清理配置，插入点：
1. **主要清理点**：`FileMoveService.deleteFileOrDirectory()` 方法中
   - 删除文件/目录成功后，调用 `KnowledgeConfigService.cleanupDocumentConfig()`
   - 清理该文件及其子文件的所有配置项
2. **辅助清理点**：`KnowledgeConfigService.readConfig()` 方法中
   - 读取配置时进行惰性清理（可选，作为兜底机制）
   - 检查 documents 中的 fileKey 是否对应的文件仍存在，清理不存在的配置
### 2. 类型定义

**新建文件**：`KnowledgeDatabase-src/src/preload/types/knowledge-config.types.ts`

```typescript
/**
 * 分块配置
 */
export interface ChunkingConfig {
  mode: 'recursive'  // 固定值
  maxChars?: number  // undefined = 跟随全局
}

/**
 * 文档配置（可覆盖全局）
 */
export interface DocumentConfig {
  chunking?: ChunkingConfig
  // 预留其他配置
}

/**
 * 知识库全局配置
 */
export interface KnowledgeGlobalConfig {
  chunking: Required<ChunkingConfig>  // 全局必须有完整配置
  // 预留其他配置
}

/**
 * 知识库配置文件结构
 */
export interface KnowledgeConfig {
  version: string
  global: KnowledgeGlobalConfig
  documents: Record<string, DocumentConfig>  // key = fileKey
}
```

### 3. 服务层实现

**新建文件**：`KnowledgeDatabase-src/src/main/services/knowledgeBase-library/knowledge-config-service.ts`

```typescript
import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import { logger } from '../logger'
import type { KnowledgeConfig, KnowledgeGlobalConfig, DocumentConfig } from '@preload/types/knowledge-config.types'

export class KnowledgeConfigService {
  private readonly defaultVersion = '1.0.0'

  /**
   * 获取配置文件路径
   */
  private getConfigPath(knowledgeBaseDocumentPath: string): string {
    return path.join(knowledgeBaseDocumentPath, '.config', 'KnowledgeConfig.json')
  }

  /**
   * 获取默认全局配置
   */
  private getDefaultGlobalConfig(): KnowledgeGlobalConfig {
    return {
      chunking: {
        mode: 'recursive',
        maxChars: 1000
      }
    }
  }

  /**
   * 确保配置文件存在
   */
  private async ensureConfigExists(configPath: string): Promise<void> {
    try {
      await fs.access(configPath)
    } catch {
      const defaultConfig: KnowledgeConfig = {
        version: this.defaultVersion,
        global: this.getDefaultGlobalConfig(),
        documents: {}
      }
      await this.writeConfig(configPath, defaultConfig)
      logger.info(`Created knowledge config file: ${configPath}`)
    }
  }

  /**
   * 读取配置文件
   */
  async readConfig(knowledgeBaseDocumentPath: string): Promise<KnowledgeConfig> {
    const configPath = this.getConfigPath(knowledgeBaseDocumentPath)
    await this.ensureConfigExists(configPath)

    try {
      const content = await fs.readFile(configPath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      logger.error('Failed to read knowledge config', error)
      return {
        version: this.defaultVersion,
        global: this.getDefaultGlobalConfig(),
        documents: {}
      }
    }
  }

  /**
   * 写入配置文件
   */
  private async writeConfig(configPath: string, config: KnowledgeConfig): Promise<void> {
    try {
      const dir = path.dirname(configPath)
      await fs.mkdir(dir, { recursive: true })

      const tempPath = `${configPath}.tmp`
      await fs.writeFile(tempPath, JSON.stringify(config, null, 2), 'utf-8')
      await fs.rename(tempPath, configPath)
    } catch (error) {
      logger.error('Failed to write knowledge config', error)
      throw error
    }
  }

  /**
   * 更新全局配置
   */
  async updateGlobalConfig(
    knowledgeBaseDocumentPath: string,
    globalConfig: Partial<KnowledgeGlobalConfig>
  ): Promise<KnowledgeConfig> {
    const config = await this.readConfig(knowledgeBaseDocumentPath)
    config.global = { ...config.global, ...globalConfig }
    
    const configPath = this.getConfigPath(knowledgeBaseDocumentPath)
    await this.writeConfig(configPath, config)
    
    logger.info('Updated global config')
    return config
  }

  /**
   * 获取文档配置（合并全局配置）
   */
  async getDocumentConfig(
    knowledgeBaseDocumentPath: string,
    fileKey: string
  ): Promise<Required<DocumentConfig>> {
    const config = await this.readConfig(knowledgeBaseDocumentPath)
    const docConfig = config.documents[fileKey] || {}

    // 合并全局配置和文档配置
    return {
      chunking: {
        mode: 'recursive',
        maxChars: docConfig.chunking?.maxChars ?? config.global.chunking.maxChars
      }
    }
  }

  /**
   * 更新文档配置
   */
  async updateDocumentConfig(
    knowledgeBaseDocumentPath: string,
    fileKey: string,
    docConfig: DocumentConfig
  ): Promise<KnowledgeConfig> {
    const config = await this.readConfig(knowledgeBaseDocumentPath)
    
    // 如果配置为空，删除该文档配置（回正）
    if (!docConfig.chunking || Object.keys(docConfig.chunking).length === 0) {
      delete config.documents[fileKey]
    } else {
      config.documents[fileKey] = docConfig
    }

    const configPath = this.getConfigPath(knowledgeBaseDocumentPath)
    await this.writeConfig(configPath, config)
    
    logger.info(`Updated document config for ${fileKey}`)
    return config
  }

  /**
   * 清除文档配置（回正）
   */
  async clearDocumentConfig(
    knowledgeBaseDocumentPath: string,
    fileKey: string
  ): Promise<KnowledgeConfig> {
    return this.updateDocumentConfig(knowledgeBaseDocumentPath, fileKey, {})
  }

  /**
   * 清理已删除文档的配置
   * @param knowledgeBaseDocumentPath 知识库文档路径
   * @param fileKey 文件标识（支持目录，会清理该目录下所有文件配置）
   */
  async cleanupDocumentConfig(
    knowledgeBaseDocumentPath: string,
    fileKey: string
  ): Promise<void> {
    const config = await this.readConfig(knowledgeBaseDocumentPath)
    const configPath = this.getConfigPath(knowledgeBaseDocumentPath)
    
    let hasChanges = false
    
    // 清理指定文件的配置
    if (config.documents[fileKey]) {
      delete config.documents[fileKey]
      hasChanges = true
    }
    
    // 如果是目录，清理该目录下所有文件的配置
    const dirPrefix = fileKey.endsWith('/') ? fileKey : `${fileKey}/`
    for (const key of Object.keys(config.documents)) {
      if (key.startsWith(dirPrefix)) {
        delete config.documents[key]
        hasChanges = true
      }
    }
    
    if (hasChanges) {
      await this.writeConfig(configPath, config)
      logger.info(`Cleaned up document config for ${fileKey}`)
    }
  }

  /**
   * 验证并清理不存在的文档配置（惰性清理）
   * @param knowledgeBaseDocumentPath 知识库文档路径
   */
  async validateAndCleanupConfig(
    knowledgeBaseDocumentPath: string
  ): Promise<void> {
    const config = await this.readConfig(knowledgeBaseDocumentPath)
    const configPath = this.getConfigPath(knowledgeBaseDocumentPath)
    const basePath = knowledgeBaseDocumentPath
    
    let hasChanges = false
    
    // 检查每个文档配置对应的文件是否存在
    for (const fileKey of Object.keys(config.documents)) {
      const fullPath = path.join(basePath, fileKey)
      try {
        await fs.access(fullPath)
      } catch {
        // 文件不存在，删除配置
        delete config.documents[fileKey]
        hasChanges = true
        logger.info(`Cleaned up orphaned config for ${fileKey}`)
      }
    }
    
    if (hasChanges) {
      await this.writeConfig(configPath, config)
    }
  }
}
```

### 4. Store层实现

**新建文件**：`KnowledgeDatabase-src/src/renderer/src/stores/knowledge-library/knowledge-config.store.ts`

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { KnowledgeConfigDataSource } from './knowledge-config.datasource'
import type { KnowledgeConfig, KnowledgeGlobalConfig, DocumentConfig } from '@preload/types/knowledge-config.types'

export const useKnowledgeConfigStore = defineStore('knowledge-config', () => {
  // 按知识库ID缓存配置
  const configByKbId = ref<Map<number, KnowledgeConfig>>(new Map())
  const loading = ref(false)

  /**
   * 获取知识库配置
   */
  const getConfig = computed(() => (kbId: number): KnowledgeConfig | null => {
    return configByKbId.value.get(kbId) ?? null
  })

  /**
   * 获取全局配置
   */
  const getGlobalConfig = computed(() => (kbId: number): KnowledgeGlobalConfig | null => {
    return configByKbId.value.get(kbId)?.global ?? null
  })

  /**
   * 获取文档配置（已合并全局）
   */
  const getDocumentConfig = computed(() => (kbId: number, fileKey: string): Required<DocumentConfig> | null => {
    const config = configByKbId.value.get(kbId)
    if (!config) return null

    const docConfig = config.documents[fileKey] || {}
    return {
      chunking: {
        mode: 'recursive',
        maxChars: docConfig.chunking?.maxChars ?? config.global.chunking.maxChars
      }
    }
  })

  /**
   * 检查文档是否有独立配置
   */
  const hasCustomConfig = computed(() => (kbId: number, fileKey: string): boolean => {
    const config = configByKbId.value.get(kbId)
    return !!config?.documents[fileKey]
  })

  /**
   * 加载配置
   */
  async function loadConfig(kbId: number): Promise<KnowledgeConfig> {
    loading.value = true
    try {
      const config = await KnowledgeConfigDataSource.getConfig(kbId)
      configByKbId.value.set(kbId, config)
      return config
    } finally {
      loading.value = false
    }
  }

  /**
   * 更新全局配置
   */
  async function updateGlobalConfig(kbId: number, globalConfig: Partial<KnowledgeGlobalConfig>): Promise<void> {
    const config = await KnowledgeConfigDataSource.updateGlobalConfig(kbId, globalConfig)
    configByKbId.value.set(kbId, config)
  }

  /**
   * 更新文档配置
   */
  async function updateDocumentConfig(kbId: number, fileKey: string, docConfig: DocumentConfig): Promise<void> {
    const config = await KnowledgeConfigDataSource.updateDocumentConfig(kbId, fileKey, docConfig)
    configByKbId.value.set(kbId, config)
  }

  /**
   * 清除文档配置（回正）
   */
  async function clearDocumentConfig(kbId: number, fileKey: string): Promise<void> {
    const config = await KnowledgeConfigDataSource.clearDocumentConfig(kbId, fileKey)
    configByKbId.value.set(kbId, config)
  }

  return {
    configByKbId,
    loading,
    getConfig,
    getGlobalConfig,
    getDocumentConfig,
    hasCustomConfig,
    loadConfig,
    updateGlobalConfig,
    updateDocumentConfig,
    clearDocumentConfig
  }
})
```

### 5. 组件改造

#### 5.1 ParseTab 拆分

**新建目录**：`KnowledgeDatabase-src/src/renderer/src/views/MainWindow/MainContent/views/KnowledgeView/KnowledgeDetail/DetailDrawer/ParseTab/`

拆分为：
- `index.vue` - 主容器
- `DocumentParsingPanel.vue` - 文档解析面板
- `VersionManagement.vue` - 版本管理
- `ChunkingPanel.vue` - 分块配置面板（支持独立配置）
- `EmbeddingPanel.vue` - 嵌入面板（占位）
- `KnowledgeGraphPanel.vue` - 知识图谱面板（占位）

#### 5.2 ChunkingPanel 组件设计

```vue
<template>
  <div class="kb-chunking-panel">
    <!-- 配置状态指示 -->
    <div v-if="hasCustomConfig" class="custom-config-badge">
      <span>使用独立配置</span>
      <button @click="handleReset">回正</button>
    </div>

    <!-- 分块模式（使用 WhiteSelect，只有一个选项） -->
    <div class="config-item">
      <label>分块模式</label>
      <WhiteSelect
        :model-value="'recursive'"
        :options="[{ label: '固定段落分块', value: 'recursive' }]"
        disabled
      />
    </div>

    <!-- 单个分段最大字符数 -->
    <div class="config-item">
      <label>单个分段最大字符数</label>
      <input
        v-model.number="localMaxChars"
        type="number"
        :placeholder="`跟随全局设置 (${globalMaxChars})`"
        :class="{ 'is-custom': hasCustomConfig }"
        @blur="handleSave"
      />
    </div>

    <!-- 分块按钮 -->
    <button @click="handleChunk">分块</button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useKnowledgeConfigStore } from '@renderer/stores/knowledge-library/knowledge-config.store'

const props = defineProps<{
  knowledgeBaseId: number
  fileKey: string
}>()

const configStore = useKnowledgeConfigStore()

// 全局配置
const globalConfig = computed(() => configStore.getGlobalConfig(props.knowledgeBaseId))
const globalMaxChars = computed(() => globalConfig.value?.chunking.maxChars ?? 1000)

// 文档配置
const documentConfig = computed(() => configStore.getDocumentConfig(props.knowledgeBaseId, props.fileKey))
const hasCustomConfig = computed(() => configStore.hasCustomConfig(props.knowledgeBaseId, props.fileKey))

// 本地编辑值
const localMaxChars = ref<number | undefined>()

// 监听配置变化
watch(documentConfig, (config) => {
  if (config) {
    localMaxChars.value = hasCustomConfig.value ? config.chunking.maxChars : undefined
  }
}, { immediate: true })

// 保存配置
const handleSave = async () => {
  if (localMaxChars.value === undefined || localMaxChars.value === globalMaxChars.value) {
    // 清除独立配置
    await configStore.clearDocumentConfig(props.knowledgeBaseId, props.fileKey)
  } else {
    // 保存独立配置
    await configStore.updateDocumentConfig(props.knowledgeBaseId, props.fileKey, {
      chunking: { mode: 'recursive', maxChars: localMaxChars.value }
    })
  }
}

// 回正
const handleReset = async () => {
  localMaxChars.value = undefined
  await configStore.clearDocumentConfig(props.knowledgeBaseId, props.fileKey)
}

// 分块
const handleChunk = async () => {
  const config = documentConfig.value
  if (!config) return
  // 调用分块逻辑
}
</script>
```

#### 5.3 SettingsView/ChunkingSection 改造

```vue
<template>
  <div class="kb-chunking-section">
    <!-- 分块模式（使用 WhiteSelect，只有一个选项） -->
    <div class="config-item">
      <label>分块模式</label>
      <WhiteSelect
        :model-value="'recursive'"
        :options="[{ label: '固定段落分块', value: 'recursive' }]"
        disabled
      />
      <p class="description">
        按照设置的单个分段最大字符数来尽量凑满，结束时优先结束在段尾，其次是句尾。
      </p>
    </div>

    <!-- 单个分段最大字符数 -->
    <div class="config-item">
      <label>单个分段最大字符数</label>
      <input
        v-model.number="localMaxChars"
        type="number"
        @blur="handleSave"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useKnowledgeConfigStore } from '@renderer/stores/knowledge-library/knowledge-config.store'

const props = defineProps<{
  knowledgeBaseId: number
}>()

const configStore = useKnowledgeConfigStore()
const localMaxChars = ref(1000)

// 加载配置
watch(() => props.knowledgeBaseId, async (kbId) => {
  await configStore.loadConfig(kbId)
  const config = configStore.getGlobalConfig(kbId)
  if (config) {
    localMaxChars.value = config.chunking.maxChars
  }
}, { immediate: true })

// 保存配置
const handleSave = async () => {
  await configStore.updateGlobalConfig(props.knowledgeBaseId, {
    chunking: { mode: 'recursive', maxChars: localMaxChars.value }
  })
}
</script>
```

---

## 实施步骤

1. **类型定义**：创建 `knowledge-config.types.ts`
2. **服务层**：创建 `knowledge-config-service.ts`（包含配置清理方法）
3. **文件删除集成**：在 `FileMoveService.deleteFileOrDirectory()` 中集成配置清理
4. **IPC Handler**：创建 knowledge-config 相关的 IPC handler
5. **Preload API**：创建 `knowledge-config-api.ts`
6. **Store层**：创建 `knowledge-config.store.ts` 和 datasource/mock
7. **组件拆分**：拆分 ParseTab 为多个子组件
8. **组件改造**：改造 ChunkingSection 和 ChunkingPanel（使用 WhiteSelect）
9. **测试验证**：测试配置读写、全局/独立配置切换、文件删除后配置清理

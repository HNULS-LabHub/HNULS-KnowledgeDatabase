<template>
  <div
    ref="kgPanelRef"
    class="kb-kg-panel flex flex-col gap-4 p-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 shadow-sm"
  >
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-md">
          <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="6" cy="12" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="18" cy="18" r="2" />
            <path d="M7.7 11.2l8-4.4" /><path d="M7.7 12.8l8 4.4" />
          </svg>
        </div>
        <div>
          <h3 class="text-base font-bold text-slate-900">Knowledge Graph / 知识图谱</h3>
          <p class="text-xs text-slate-500 mt-0.5">从文档中提取实体与关系</p>
        </div>
      </div>
      <div v-if="buildState" class="px-3 py-1 rounded-full text-xs font-semibold" :class="statusBadgeClass">
        {{ statusText }}
      </div>
    </div>

    <!-- Content -->
    <div class="flex flex-col gap-3">
      <!-- 配置选择 -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-slate-700">知识图谱配置</label>
        <WhiteSelect
          v-model="selectedKgConfigId"
          :options="kgConfigOptions"
          placeholder="请先在设置中创建知识图谱配置"
          :disabled="isBuilding"
        />
      </div>

      <!-- 嵌入状态提示 -->
      <div v-if="selectedKgConfigId && !hasEmbeddingForConfig" class="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
        <svg class="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <p class="text-xs text-amber-700">
          该配置关联的嵌入方案「{{ linkedEmbeddingName }}」尚未对此文档完成嵌入，请先完成嵌入后再构建知识图谱。
        </p>
      </div>

      <!-- 操作按钮 -->
      <button
        class="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-medium text-sm shadow-md hover:shadow-lg hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md"
        :disabled="!canBuild"
        @click="handleBuild"
      >
        <svg v-if="!isBuilding" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
        <svg v-else class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        {{ isBuilding ? '构建中...' : '构建知识图谱' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, inject } from 'vue'
import { useKnowledgeConfigStore } from '@renderer/stores/knowledge-library/knowledge-config.store'
import { useKnowledgeLibraryStore } from '@renderer/stores/knowledge-library/knowledge-library.store'
import { useKgBuildStore } from '@renderer/stores/knowledge-graph'
import WhiteSelect from '@renderer/components/select/WhiteSelect.vue'
import type { FileNode } from '../../../types'
import type { EmbeddingTableInfo } from '@preload/types'

const props = defineProps<{
  fileKey: string
  knowledgeBaseId?: number
  fileData?: FileNode | null
}>()

const configStore = useKnowledgeConfigStore()
const libraryStore = useKnowledgeLibraryStore()
const kgBuildStore = useKgBuildStore()

// 注入 message toast
const toast = inject<{ success: Function; error: Function; warning: Function; info: Function }>('toast')

const kgPanelRef = ref<HTMLElement | null>(null)
const selectedKgConfigId = ref<string | null>(null)
const embeddingTables = ref<EmbeddingTableInfo[]>([])

// 知识图谱配置列表
const kgConfigs = computed(() =>
  props.knowledgeBaseId ? configStore.getKgConfigs(props.knowledgeBaseId) : []
)

// 默认配置ID
const defaultKgConfigId = computed(() =>
  props.knowledgeBaseId ? configStore.getDefaultKgConfigId(props.knowledgeBaseId) : null
)

// 选项列表
const kgConfigOptions = computed(() => {
  const options = kgConfigs.value.map((c) => ({
    label: `${c.name}${c.id === defaultKgConfigId.value ? ' [默认]' : ''}`,
    value: c.id
  }))
  if (defaultKgConfigId.value) {
    const defaultCfg = kgConfigs.value.find((c) => c.id === defaultKgConfigId.value)
    const defaultLabel = defaultCfg ? `默认 (${defaultCfg.name})` : '默认'
    return [{ label: defaultLabel, value: defaultKgConfigId.value }, ...options.filter((o) => o.value !== defaultKgConfigId.value)]
  }
  return options
})

// 当前选中的配置对象
const selectedConfig = computed(() =>
  kgConfigs.value.find((c) => c.id === selectedKgConfigId.value) ?? null
)

// 关联的嵌入配置名称
const linkedEmbeddingName = computed(() => {
  if (!selectedConfig.value || !props.knowledgeBaseId) return '未知'
  const embeddingConfigs = configStore.getEmbeddingConfigs(props.knowledgeBaseId)
  const found = embeddingConfigs.find((c) => c.id === selectedConfig.value!.embeddingConfigId)
  return found?.name ?? '未知'
})

// 检查文档在关联嵌入配置下是否已完成嵌入
const hasEmbeddingForConfig = computed(() => {
  if (!selectedConfig.value || !props.fileData?.embeddingInfo) return false
  // 通过嵌入配置名称匹配 embeddingInfo
  const embeddingConfigs = props.knowledgeBaseId
    ? configStore.getEmbeddingConfigs(props.knowledgeBaseId)
    : []
  const linkedEmbedding = embeddingConfigs.find(
    (c) => c.id === selectedConfig.value!.embeddingConfigId
  )
  if (!linkedEmbedding) return false

  // 检查 fileData.embeddingInfo 中是否有该配置名称且 status 为 completed
  return props.fileData.embeddingInfo.some(
    (info) => info.configName === linkedEmbedding.name && info.status === 'completed'
  )
})

// 获取关联嵌入配置对应的表名
const linkedEmbeddingTableName = computed(() => {
  if (!selectedConfig.value) return null
  const targetId = selectedConfig.value.embeddingConfigId
  // 表名中的 configId 可能带 cfg_ 前缀（emb_cfg_xxx_dim_chunks → configId = cfg_xxx）
  // 需要做模糊匹配
  const table = embeddingTables.value.find(
    (t) =>
      t.configId === targetId ||
      t.configId === `cfg_${targetId}` ||
      `cfg_${t.configId}` === targetId ||
      t.configId.replace(/^cfg_/, '') === targetId.replace(/^cfg_/, '')
  )
  return table?.tableName ?? null
})

// 构建状态
const buildState = computed(() => kgBuildStore.getState(props.fileKey))
const isBuilding = computed(() => kgBuildStore.isRunning(props.fileKey))

// 是否可以构建
const canBuild = computed(() => {
  if (!selectedKgConfigId.value) return false
  if (isBuilding.value) return false
  if (!hasEmbeddingForConfig.value) return false
  return true
})

const statusText = computed(() => {
  if (!buildState.value) return ''
  switch (buildState.value.status) {
    case 'running': return '构建中'
    case 'completed': return '已完成'
    case 'failed': return '失败'
    default: return ''
  }
})

const statusBadgeClass = computed(() => {
  if (!buildState.value) return ''
  switch (buildState.value.status) {
    case 'running': return 'bg-blue-100 text-blue-700'
    case 'completed': return 'bg-green-100 text-green-700'
    case 'failed': return 'bg-red-100 text-red-700'
    default: return 'bg-slate-100 text-slate-600'
  }
})

// 初始化
onMounted(async () => {
  if (props.knowledgeBaseId) {
    await configStore.loadConfig(props.knowledgeBaseId)
    // 加载嵌入表信息
    try {
      embeddingTables.value = await window.api.knowledgeLibrary.listEmbeddingTables(props.knowledgeBaseId)
    } catch (e) {
      console.error('Failed to load embedding tables:', e)
    }
  }
})

// 默认选中
watch(
  [kgConfigs, defaultKgConfigId],
  () => {
    if (!selectedKgConfigId.value && defaultKgConfigId.value) {
      selectedKgConfigId.value = defaultKgConfigId.value
    } else if (!selectedKgConfigId.value && kgConfigs.value.length > 0) {
      selectedKgConfigId.value = kgConfigs.value[0].id
    }
  },
  { immediate: true }
)

async function handleBuild(): Promise<void> {
  if (!canBuild.value || !selectedConfig.value) return

  const knowledgeBase = props.knowledgeBaseId ? libraryStore.getById(props.knowledgeBaseId) : null
  if (!knowledgeBase) {
    toast?.error('知识图谱构建', '无法获取知识库信息')
    return
  }

  // 获取嵌入表名，如果还没加载到就尝试重新获取
  let tableName = linkedEmbeddingTableName.value
  if (!tableName && props.knowledgeBaseId) {
    try {
      embeddingTables.value = await window.api.knowledgeLibrary.listEmbeddingTables(props.knowledgeBaseId)
      tableName = embeddingTables.value.find((t) => {
        const targetId = selectedConfig.value!.embeddingConfigId
        return (
          t.configId === targetId ||
          t.configId === `cfg_${targetId}` ||
          `cfg_${t.configId}` === targetId ||
          t.configId.replace(/^cfg_/, '') === targetId.replace(/^cfg_/, '')
        )
      })?.tableName ?? null
    } catch (e) {
      // ignore
    }
  }
  if (!tableName) {
    toast?.error('知识图谱构建', '无法获取嵌入表信息，请确认嵌入已完成')
    return
  }

  const fileName = props.fileData?.name || props.fileKey
  toast?.info('知识图谱构建', `开始构建: ${fileName}`)

  const result = await kgBuildStore.startBuild({
    fileKey: props.fileKey,
    databaseName: knowledgeBase.databaseName,
    kgConfig: selectedConfig.value,
    embeddingTableName: tableName
  })

  if (result.success) {
    toast?.success('知识图谱构建', `${fileName} 任务已提交`)
  } else {
    toast?.error('知识图谱构建', `${fileName} 构建失败: ${result.error}`)
  }
}

defineExpose({ kgPanelRef })
</script>

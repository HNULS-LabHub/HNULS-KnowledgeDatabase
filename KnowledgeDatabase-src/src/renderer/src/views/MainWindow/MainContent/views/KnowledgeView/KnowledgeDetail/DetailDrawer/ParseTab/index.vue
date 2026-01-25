<template>
  <div class="KnowledgeView_KnowledgeDetail_DetailDrawer_tabContent">
    <!-- KnowledgeView_KnowledgeDetail_DetailDrawer_parseRoot: 解析状态Tab根容器（标注类，不负责样式） -->
    <div
      class="KnowledgeView_KnowledgeDetail_DetailDrawer_parseRoot h-full w-full bg-white text-slate-800 font-sans flex flex-col overflow-hidden relative"
    >
      <!-- 横向导航条 -->
      <ParseNavBar
        :sections="sections"
        :active-section="activeSection"
        @scroll-to-section="scrollToSection"
      />

      <!-- 可滚动内容区 -->
      <div
        ref="contentRef"
        class="KnowledgeView_KnowledgeDetail_DetailDrawer_parseContent flex-1 overflow-y-auto overflow-x-hidden scroll-smooth p-4 gap-4 flex flex-col"
      >
        <!-- 顶部标题区 -->
        <ParseHeader />

        <!-- MinerU解析面板 -->
        <MinerUPanel
          ref="documentParsingRef"
          :file-key="fileKey"
          :is-parsing="isParsing"
          :progress="progress"
          @start-parsing="handleStartParsing"
        />

        <!-- 版本管理 -->
        <VersionManager
          :versions="versions"
          :active-version-id="activeVersionId"
          @switch-version="handleSwitchVersion"
        />

        <!-- 分块配置区域 -->
        <div
          ref="chunkingRef"
          class="KnowledgeView_KnowledgeDetail_DetailDrawer_chunkingSection flex flex-col gap-4 mt-auto"
        >
          <!-- 分块配置面板 -->
          <ChunkingPanel
            :file-key="fileKey"
            :knowledge-base-id="knowledgeBaseId"
            :can-chunk="canChunk"
            :chunking-disabled-reason="chunkingDisabledReason"
            :is-loading-chunking="isLoadingChunking"
            :has-chunks="hasChunks"
            @start-chunking="handleStartChunking"
            @show-preview="handleShowPreview"
          />

          <!-- 嵌入面板 -->
          <EmbeddingPanel
            ref="embeddingRef"
            :file-key="fileKey"
            :knowledge-base-id="knowledgeBaseId"
            :file-data="fileData"
            :can-embed="canEmbed"
            :embedding-disabled-reason="embeddingDisabledReason"
          />

          <!-- 知识图谱占位 -->
          <PendingFeatureCard
            ref="knowledgeGraphRef"
            title="Knowledge Graph / 知识图谱"
            icon="knowledge-graph"
          />
        </div>
      </div>
    </div>

    <!-- 分块预览对话框 -->
    <ChunkingPreviewDialog
      v-model:visible="showChunkingPreview"
      :config="chunkingConfig"
      :chunks="chunkingChunks"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useParsingStore } from '@renderer/stores/parsing/parsing.store'
import { useChunkingStore } from '@renderer/stores/chunking/chunking.store'
import { useKnowledgeLibraryStore } from '@renderer/stores/knowledge-library/knowledge-library.store'
import { useKnowledgeConfigStore } from '@renderer/stores/knowledge-library/knowledge-config.store'
import type { TaskHandle } from '@preload/types'
import { canChunkFile, isPlainTextFile } from '@renderer/stores/chunking/chunking.util'
import ChunkingPreviewDialog from '../../SettingsView/ChunkingPreviewDialog.vue'
import type { ChunkingConfig } from '@renderer/stores/chunking/chunking.types'
import type { FileNode } from '../../../types'
import ParseNavBar from './ParseNavBar.vue'
import ParseHeader from './ParseHeader.vue'
import MinerUPanel from './MinerUPanel.vue'
import VersionManager from './VersionManager.vue'
import ChunkingPanel from './ChunkingPanel.vue'
import EmbeddingPanel from './EmbeddingPanel.vue'
import PendingFeatureCard from './PendingFeatureCard.vue'
import type { Section } from './types'

const props = defineProps<{
  fileKey: string
  knowledgeBaseId?: number
  fileData?: FileNode | null
}>()

const parsingStore = useParsingStore()
const chunkingStore = useChunkingStore()
const knowledgeLibraryStore = useKnowledgeLibraryStore()
const configStore = useKnowledgeConfigStore()

// 分块配置：从 config store 获取（文档配置或全局配置）
const chunkingConfig = computed<ChunkingConfig>(() => {
  if (!props.knowledgeBaseId || !props.fileKey) {
    return { mode: 'recursive', maxChars: 1000 }
  }
  const docConfig = configStore.getDocumentConfig(props.knowledgeBaseId, props.fileKey)
  return docConfig?.chunking ?? { mode: 'recursive', maxChars: 1000 }
})

const showChunkingPreview = ref(false)

const chunkingState = computed(() => {
  if (!props.fileKey) return null
  return chunkingStore.getState(props.fileKey)
})

const chunkingChunks = computed(() => {
  return chunkingState.value?.chunks ?? []
})

const isLoadingChunking = computed(() => {
  if (!props.fileKey) return false
  return chunkingStore.isLoading(props.fileKey)
})

// 检查是否有分块结果
const hasChunks = computed(() => {
  if (!props.fileKey) return false
  return chunkingStore.hasChunks(props.fileKey, chunkingConfig.value)
})

// 文件扩展名
const fileExtension = computed(() => {
  return props.fileData?.extension || ''
})

// 是否为纯文本文件
const isPlainText = computed(() => {
  return isPlainTextFile(fileExtension.value)
})

// 是否已解析（对于非纯文本文件需要先解析）
const isFileParsed = computed(() => {
  // 优先使用 fileData 的 status 字段
  if (props.fileData?.status === 'parsed') {
    return true
  }

  // 其次检查 parsingState
  const state = parsingState.value
  if (!state || !state.activeVersionId) return false
  const version = state.versions.find((v) => v.id === state.activeVersionId)
  return version?.name.includes('完成') || false
})

// 是否可以进行分块操作
const canChunk = computed(() => {
  return canChunkFile(fileExtension.value, isFileParsed.value)
})

// 分块功能不可用的原因提示
const chunkingDisabledReason = computed(() => {
  if (!fileExtension.value) {
    return '无法识别文件类型'
  }
  if (isPlainText.value) {
    return '' // 纯文本文件可以直接分块
  }
  if (!isFileParsed.value) {
    return '该文件类型需要先完成文档解析才能进行分块'
  }
  return ''
})

// 是否可以进行嵌入操作（需要先完成分块）
const canEmbed = computed(() => {
  return hasChunks.value
})

// 嵌入功能不可用的原因提示
const embeddingDisabledReason = computed(() => {
  if (!hasChunks.value) {
    return '需要先完成分块才能进行嵌入'
  }
  return ''
})

const sections: Section[] = [
  { id: 'document-parsing', label: '文档解析' },
  { id: 'chunking', label: '分块' },
  { id: 'embedding', label: '嵌入' },
  { id: 'knowledge-graph', label: '知识图谱' }
]

const activeSection = ref<string>(sections[0].id)
const contentRef = ref<HTMLElement | null>(null)
const documentParsingRef = ref<InstanceType<typeof MinerUPanel> | null>(null)
const chunkingRef = ref<HTMLElement | null>(null)
const embeddingRef = ref<InstanceType<typeof EmbeddingPanel> | null>(null)
const knowledgeGraphRef = ref<InstanceType<typeof PendingFeatureCard> | null>(null)

const sectionRefs = computed(() => ({
  'document-parsing': documentParsingRef.value?.$el,
  chunking: chunkingRef.value,
  embedding: embeddingRef.value?.embeddingPanelRef,
  'knowledge-graph': knowledgeGraphRef.value?.$el
}))

let observer: IntersectionObserver | null = null

const scrollToSection = (sectionId: string): void => {
  activeSection.value = sectionId
  const sectionRef = sectionRefs.value[sectionId as keyof typeof sectionRefs.value]
  if (sectionRef && contentRef.value) {
    sectionRef.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

const parsingState = computed(() => {
  if (!props.fileKey) return null
  return parsingStore.getState(props.fileKey)
})

const versions = computed(() => parsingState.value?.versions ?? [])

const activeVersionId = computed(() => parsingState.value?.activeVersionId ?? null)

const isParsing = computed(() => {
  const st = parsingStore.getState(props.fileKey)
  const v = st?.activeVersionId ? st.versions.find((x) => x.id === st.activeVersionId) : null
  return Boolean(v && !v.name.includes('完成') && !v.name.includes('失败'))
})

const progress = computed(() => {
  const st = parsingStore.getState(props.fileKey)
  const p = st?.progress
  return typeof p === 'number' ? p : 0
})

// 加载配置
watch(
  () => props.knowledgeBaseId,
  async (kbId) => {
    if (!kbId) return
    await configStore.loadConfig(kbId)
  },
  { immediate: true }
)

watch(
  [() => props.fileKey, () => props.knowledgeBaseId],
  async ([key, kbId]) => {
    if (!key) return
    await parsingStore.ensureState(key, { knowledgeBaseId: kbId })
  },
  { immediate: true }
)

// 监听分块配置变化，更新分块状态（仅在可以分块时）
watch(
  [
    () => props.fileKey,
    () => chunkingConfig.value,
    () => canChunk.value,
    () => props.knowledgeBaseId
  ],
  async ([key, config, canChunkFile, kbId]) => {
    if (!key || !canChunkFile) return
    await chunkingStore.ensureState(key, config, {
      knowledgeBaseId: kbId
    })
  },
  { immediate: true, deep: true }
)

// 监听滚动，更新 activeSection
onMounted(() => {
  if (!contentRef.value) return

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
          const sectionId = entry.target.getAttribute('data-section-id')
          if (sectionId) {
            activeSection.value = sectionId
          }
        }
      })
    },
    { threshold: 0.5, rootMargin: '-100px 0px', root: contentRef.value }
  )

  Object.keys(sectionRefs.value).forEach((sectionId) => {
    const ref = sectionRefs.value[sectionId as keyof typeof sectionRefs.value]
    if (ref) {
      ref.setAttribute('data-section-id', sectionId)
      observer?.observe(ref)
    }
  })
})

onBeforeUnmount(() => {
  if (observer) {
    observer.disconnect()
  }
})

const handleSwitchVersion = async (versionId: string): Promise<void> => {
  if (!props.fileKey) return
  if (!versionId) return
  await parsingStore.switchActiveVersion(props.fileKey, versionId, props.knowledgeBaseId)
}

const handleStartParsing = async (): Promise<void> => {
  if (!props.fileKey) return
  if (!props.knowledgeBaseId) return
  if (isParsing.value) return

  let taskHandle: TaskHandle | null = null

  try {
    // 获取知识库名称和文件名
    const kb = knowledgeLibraryStore.getById(props.knowledgeBaseId)
    const knowledgeBaseName = kb?.name || `知识库 ${props.knowledgeBaseId}`
    const fileName = props.fileData?.name || props.fileKey.split('/').pop() || '未知文件'

    // 创建任务
    taskHandle = await window.api.taskMonitor.createTask({
      type: 'parsing',
      title: `文档解析 - ${fileName}`,
      meta: {
        fileKey: props.fileKey,
        fileName,
        knowledgeBaseId: props.knowledgeBaseId,
        knowledgeBaseName
      }
    })

    // 启动解析
    await parsingStore.startParsing(props.fileKey, {
      parserName: 'MinerU Parser',
      knowledgeBaseId: props.knowledgeBaseId
    })

    // 获取解析结果以获取 versionId 和 batchId
    const parsingStateResult = parsingStore.getState(props.fileKey)
    if (parsingStateResult && parsingStateResult.activeVersionId) {
      const statusRes = await window.api.minerU.getStatus(props.fileKey)
      if (statusRes.success && statusRes.data) {
        taskHandle.updateProgress(50, {
          versionId: parsingStateResult.activeVersionId,
          batchId: statusRes.data.batchId
        })
      }
    }

    taskHandle.complete()
  } catch (error) {
    console.error('[ParseTab] Failed to start parsing:', error)
    taskHandle?.fail(error instanceof Error ? error.message : '解析失败')
  }
}

// 分块操作处理
const handleStartChunking = async (): Promise<void> => {
  if (!props.fileKey) return
  if (!props.knowledgeBaseId) return
  if (isLoadingChunking.value) return
  if (!canChunk.value) return

  try {
    // 获取解析版本 ID（对于非纯文本文件）
    let parsingVersionId: string | undefined
    if (!isPlainText.value) {
      const state = parsingState.value
      if (state?.activeVersionId) {
        parsingVersionId = state.activeVersionId
      } else {
        // 提示需要先解析
        console.warn('非纯文本文件需要先完成解析')
        return
      }
    }

    // 执行分块（异步，不阻塞）
    await chunkingStore.startChunking(props.fileKey, chunkingConfig.value, {
      knowledgeBaseId: props.knowledgeBaseId,
      fileRelativePath: props.fileKey,
      parsingVersionId
    })

    // 分块完成后可以自动显示预览（可选）
    // showChunkingPreview.value = true
  } catch (error) {
    console.error('分块失败:', error)
    // 可以添加错误提示
  }
}

// 预览处理（确保状态已加载）
const handleShowPreview = async (): Promise<void> => {
  if (!props.fileKey) return
  if (!hasChunks.value) return

  // 确保分块状态已加载
  await chunkingStore.ensureState(props.fileKey, chunkingConfig.value, {
    knowledgeBaseId: props.knowledgeBaseId
  })
  showChunkingPreview.value = true
}
</script>

<style scoped>
.KnowledgeView_KnowledgeDetail_DetailDrawer_tabContent {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}
</style>

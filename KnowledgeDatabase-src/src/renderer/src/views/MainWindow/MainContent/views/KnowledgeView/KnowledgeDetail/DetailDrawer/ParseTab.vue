<template>
  <div class="KnowledgeView_KnowledgeDetail_DetailDrawer_tabContent">
    <!-- KnowledgeView_KnowledgeDetail_DetailDrawer_parseRoot: 解析状态Tab根容器（标注类，不负责样式） -->
    <div
      class="KnowledgeView_KnowledgeDetail_DetailDrawer_parseRoot h-full w-full bg-white text-slate-800 font-sans flex flex-col overflow-hidden relative"
    >
      <!-- KnowledgeView_KnowledgeDetail_DetailDrawer_parseNavBar: 横向导航条（标注类，不负责样式） -->
      <div
        class="KnowledgeView_KnowledgeDetail_DetailDrawer_parseNavBar flex items-center gap-1 px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0 overflow-x-auto"
      >
        <button
          v-for="section in sections"
          :key="section.id"
          class="KnowledgeView_KnowledgeDetail_DetailDrawer_parseNavBtn px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200"
          :class="{
            'KnowledgeView_KnowledgeDetail_DetailDrawer_parseNavBtn-active bg-blue-50 text-blue-600':
              activeSection === section.id,
            'KnowledgeView_KnowledgeDetail_DetailDrawer_parseNavBtn-inactive text-slate-600 hover:bg-slate-50':
              activeSection !== section.id
          }"
          @click="scrollToSection(section.id)"
        >
          {{ section.label }}
        </button>
      </div>

      <!-- KnowledgeView_KnowledgeDetail_DetailDrawer_parseContent: 可滚动内容区（标注类，不负责样式） -->
      <div
        ref="contentRef"
        class="KnowledgeView_KnowledgeDetail_DetailDrawer_parseContent flex-1 overflow-y-auto overflow-x-hidden scroll-smooth p-4 gap-4 flex flex-col"
      >
        <!-- KnowledgeView_KnowledgeDetail_DetailDrawer_parseTitle: 顶部标题区（标注类，不负责样式） -->
        <div
          class="KnowledgeView_KnowledgeDetail_DetailDrawer_parseTitle flex items-center gap-2 pb-2 border-b border-slate-100 flex-shrink-0"
        >
          <div class="bg-blue-50 p-1 rounded-md">
            <svg
              class="w-4 h-4 text-blue-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M12 20V10"></path>
              <path d="M18 20V4"></path>
              <path d="M6 20v-6"></path>
            </svg>
          </div>
          <span class="text-sm font-bold tracking-wide text-slate-800">文档解析器</span>
          <span
            class="ml-auto text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
            >V2.1</span
          >
        </div>

        <!-- KnowledgeView_KnowledgeDetail_DetailDrawer_parsePanel: MinerU解析面板（标注类，不负责样式） -->
        <div
          ref="documentParsingRef"
          class="KnowledgeView_KnowledgeDetail_DetailDrawer_parsePanel flex-shrink-0 bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-xl p-4 relative overflow-hidden group shadow-sm"
        >
          <div
            class="absolute top-0 right-0 w-24 h-24 bg-blue-100/30 rounded-bl-full pointer-events-none"
          />
          <div
            class="absolute bottom-0 left-0 w-16 h-16 bg-indigo-100/30 rounded-tr-full pointer-events-none"
          />

          <div class="flex items-center justify-between mb-4 relative z-10">
            <div class="flex flex-col min-w-0">
              <span
                class="text-[10px] font-mono font-semibold text-blue-600 mb-0.5 tracking-wider uppercase"
                >Current Target</span
              >
              <span class="text-sm font-bold text-slate-800 flex items-center gap-2 min-w-0">
                <svg
                  class="w-3.5 h-3.5 text-slate-500 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14,2 14,8 20,8"></polyline>
                </svg>
                <span class="truncate" :title="fileKey">{{ fileKey || '-' }}</span>
              </span>
            </div>

            <!-- KnowledgeView_KnowledgeDetail_DetailDrawer_parseStatusLamp: 运行态指示灯（标注类，不负责样式） -->
            <div
              class="KnowledgeView_KnowledgeDetail_DetailDrawer_parseStatusLamp flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium border"
              :class="
                isParsing
                  ? 'bg-blue-50 text-blue-600 border-blue-100'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              "
            >
              <div
                class="w-1.5 h-1.5 rounded-full"
                :class="isParsing ? 'bg-blue-500 animate-pulse' : 'bg-slate-400'"
              />
              {{ isParsing ? 'RUNNING' : 'READY' }}
            </div>
          </div>

          <!-- KnowledgeView_KnowledgeDetail_DetailDrawer_parseProgress: 总进度（标注类，不负责样式） -->
          <div class="space-y-2 mb-4">
            <div class="flex justify-between text-[10px] font-mono text-slate-500">
              <span>PROGRESS</span>
              <span :class="isParsing ? 'text-blue-600 font-bold' : ''">
                {{ isParsing ? `${Math.floor(progress)}%` : 'IDLE' }}
              </span>
            </div>

            <div
              class="h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200 relative"
            >
              <div
                class="absolute top-0 left-0 h-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.3)] transition-all duration-200"
                :style="{ width: `${progress}%` }"
              />
              <div v-if="isParsing" class="absolute inset-0 bg-white/30 animate-pulse" />
            </div>
          </div>

          <!-- KnowledgeView_KnowledgeDetail_DetailDrawer_parseStartBtn: 主按钮（标注类，不负责样式） -->
          <button
            class="KnowledgeView_KnowledgeDetail_DetailDrawer_parseStartBtn w-full relative group/btn overflow-hidden rounded-lg border transition-all duration-300 py-2.5 shadow-sm"
            :disabled="!fileKey || isParsing"
            :class="
              isParsing
                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-white border-slate-300 text-slate-700 hover:border-blue-500 hover:text-blue-600 hover:shadow-md'
            "
            @click="handleStartParsing"
          >
            <div
              class="relative z-10 flex items-center justify-center gap-2 text-xs font-bold tracking-wider"
            >
              <template v-if="isParsing">
                <svg
                  class="w-3.5 h-3.5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="12" cy="12" r="10" opacity="0.25" />
                  <path d="M22 12a10 10 0 0 1-10 10" />
                </svg>
                <span>解析中...</span>
              </template>
              <template v-else>
                <svg
                  class="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M12 2v20"></path>
                  <path d="M2 12h20"></path>
                </svg>
                <span>开始 MinerU 解析</span>
              </template>
            </div>
          </button>
        </div>

        <!-- KnowledgeView_KnowledgeDetail_DetailDrawer_versionCard: 版本管理（标注类，不负责样式） -->
        <div
          class="KnowledgeView_KnowledgeDetail_DetailDrawer_versionCard flex flex-col flex-shrink-0 h-[320px] bg-slate-50/50 border border-slate-200 rounded-xl overflow-hidden"
        >
          <div
            class="h-10 px-3 flex items-center justify-between bg-slate-100/50 border-b border-slate-200"
          >
            <div class="flex items-center gap-2 text-xs font-bold text-slate-700">
              <svg
                class="w-3.5 h-3.5 text-slate-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M6 3v12"></path>
                <path d="M18 9v12"></path>
                <path d="M6 15c3 0 3 6 6 6s3-6 6-6"></path>
              </svg>
              <span>版本管理</span>
            </div>
            <span
              class="text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-sm"
            >
              {{ versions.length }} Snapshots
            </span>
          </div>

          <div class="flex-1 overflow-y-auto p-2 space-y-1 relative bg-white">
            <div
              class="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-white to-transparent pointer-events-none z-10"
            />

            <div
              v-for="v in versions"
              :key="v.id"
              class="KnowledgeView_KnowledgeDetail_DetailDrawer_versionNode group relative flex items-center gap-3 py-2.5 pl-2 pr-2 cursor-pointer select-none transition-all duration-200 ease-out rounded-lg border border-transparent"
              :class="
                activeVersionId === v.id
                  ? 'bg-blue-50 border-blue-100 shadow-sm'
                  : 'hover:bg-slate-100'
              "
              @click="handleSwitchVersion(v.id)"
            >
              <div class="absolute left-[15px] top-0 bottom-0 w-[1px] bg-slate-200 -z-10" />

              <div class="relative z-10 flex-shrink-0 flex items-center justify-center w-4">
                <div
                  class="absolute rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                  :class="activeVersionId === v.id ? 'w-6 h-6 bg-blue-500/10' : 'w-0 h-0 opacity-0'"
                />
                <div
                  class="rounded-full border-2 transition-all duration-300 z-20 box-border"
                  :class="
                    activeVersionId === v.id
                      ? 'w-3 h-3 bg-white border-blue-500 shadow-[0_0_0_2px_rgba(59,130,246,0.1)]'
                      : 'w-2 h-2 bg-slate-400 border-white ring-2 ring-white group-hover:border-blue-300 group-hover:bg-blue-100'
                  "
                />
              </div>

              <div class="flex-1 min-w-0 flex flex-col">
                <div class="flex justify-between items-baseline">
                  <span
                    class="text-xs font-mono tracking-tight transition-colors duration-200 truncate"
                    :class="
                      activeVersionId === v.id
                        ? 'text-blue-700 font-bold'
                        : 'text-slate-600 group-hover:text-slate-900'
                    "
                  >
                    {{ v.id }}
                  </span>
                  <span
                    class="text-[10px] font-mono flex-shrink-0 ml-2"
                    :class="activeVersionId === v.id ? 'text-blue-400' : 'text-slate-400'"
                  >
                    {{ v.timestamp }}
                  </span>
                </div>
                <span
                  class="text-[11px] truncate transition-colors"
                  :class="activeVersionId === v.id ? 'text-blue-600/80' : 'text-slate-500'"
                >
                  {{ v.name }}
                </span>
              </div>
            </div>

            <div
              class="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-white to-transparent pointer-events-none z-10"
            />
          </div>
        </div>

        <!-- KnowledgeView_KnowledgeDetail_DetailDrawer_chunkingSection: 分块配置区域（标注类，不负责样式） -->
        <div
          ref="chunkingRef"
          class="KnowledgeView_KnowledgeDetail_DetailDrawer_chunkingSection flex flex-col gap-4 mt-auto"
        >
          <!-- KnowledgeView_KnowledgeDetail_DetailDrawer_chunkingPanel: 分块配置面板（标注类，不负责样式） -->
          <div
            class="KnowledgeView_KnowledgeDetail_DetailDrawer_chunkingPanel flex-shrink-0 bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-xl p-4 relative overflow-hidden group shadow-sm"
          >
            <div
              class="absolute top-0 right-0 w-24 h-24 bg-blue-100/30 rounded-bl-full pointer-events-none"
            />
            <div
              class="absolute bottom-0 left-0 w-16 h-16 bg-indigo-100/30 rounded-tr-full pointer-events-none"
            />

            <div class="flex items-center gap-2 mb-4 relative z-10">
              <div class="bg-blue-50 p-1 rounded-md">
                <svg
                  class="w-4 h-4 text-blue-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <path d="M8 9h8" />
                  <path d="M8 13h6" />
                </svg>
              </div>
              <span class="text-sm font-bold tracking-wide text-slate-800">分块配置</span>
            </div>

            <div class="space-y-4 relative z-10">
              <!-- 分块功能不可用提示 -->
              <div
                v-if="!canChunk"
                class="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg"
              >
                <svg
                  class="w-4 h-4 text-amber-600 shrink-0 mt-0.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M12 9v4"></path>
                  <path d="M12 17h.01"></path>
                  <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"></path>
                </svg>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-medium text-amber-800 mb-1">分块功能暂不可用</p>
                  <p class="text-xs text-amber-700 leading-relaxed">
                    {{ chunkingDisabledReason }}
                  </p>
                </div>
              </div>

              <!-- 分块配置（仅在可用时显示） -->
              <template v-if="canChunk">
                <!-- 分块模式显示（固定为段落分块） -->
                <div class="flex flex-col gap-2">
                  <label class="text-xs font-medium text-slate-700">分块模式</label>
                  <div
                    class="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600"
                  >
                    段落分块模式
                  </div>
                  <p class="text-xs text-slate-500 leading-relaxed">
                    按照设置的单个分段最大字符数来尽量凑满，结束时优先结束在段尾，其次是句尾。适合层次化文档结构，分块更加精细。
                  </p>
                </div>

                <!-- 单个分段最大字符数 -->
                <div class="flex flex-col gap-2">
                  <label class="text-xs font-medium text-slate-700">单个分段最大字符数</label>
                  <input
                    v-model.number="chunkingConfig.maxChars"
                    type="number"
                    min="100"
                    max="10000"
                    step="50"
                    class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    placeholder="例如：1000"
                    :disabled="!canChunk"
                  />
                  <p class="text-xs text-slate-400">
                    建议范围：500-2000 字符，过小可能导致上下文丢失，过大可能影响检索效果
                  </p>
                </div>

                <!-- 预览按钮 -->
                <div class="pt-2">
                  <button
                    class="KnowledgeView_KnowledgeDetail_DetailDrawer_chunkingPreviewBtn w-full relative group/btn overflow-hidden rounded-lg border transition-all duration-300 py-2.5 shadow-sm"
                    :class="
                      !fileKey || isLoadingChunking
                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-white border-slate-300 text-slate-700 hover:border-blue-500 hover:text-blue-600 hover:shadow-md'
                    "
                    :disabled="!fileKey || isLoadingChunking || !canChunk"
                    @click="handleShowPreview"
                  >
                    <div
                      class="relative z-10 flex items-center justify-center gap-2 text-xs font-bold tracking-wider"
                    >
                      <svg
                        class="w-3.5 h-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                      <span>预览分块</span>
                    </div>
                  </button>
                </div>
              </template>
            </div>
          </div>

          <div
            ref="embeddingRef"
            class="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-3 group hover:border-slate-300 hover:shadow-sm transition-all"
          >
            <div
              class="flex items-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity"
            >
              <div
                class="p-1.5 rounded bg-slate-100 group-hover:bg-slate-200/50 text-slate-500 group-hover:text-slate-700"
              >
                <svg
                  class="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M4 7h16" />
                  <path d="M4 12h16" />
                  <path d="M4 17h16" />
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="text-xs font-semibold text-slate-700">Vector Embedding / 嵌入</h3>
                <span
                  class="text-[10px] font-mono text-amber-600/80 border border-amber-200 bg-amber-50 px-1 rounded inline-block mt-0.5"
                  >PENDING</span
                >
              </div>
            </div>
            <div
              class="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:8px_8px] opacity-20 pointer-events-none"
            />
          </div>

          <div
            ref="knowledgeGraphRef"
            class="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-3 group hover:border-slate-300 hover:shadow-sm transition-all"
          >
            <div
              class="flex items-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity"
            >
              <div
                class="p-1.5 rounded bg-slate-100 group-hover:bg-slate-200/50 text-slate-500 group-hover:text-slate-700"
              >
                <svg
                  class="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="6" cy="12" r="2" />
                  <circle cx="18" cy="6" r="2" />
                  <circle cx="18" cy="18" r="2" />
                  <path d="M7.7 11.2l8-4.4" />
                  <path d="M7.7 12.8l8 4.4" />
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="text-xs font-semibold text-slate-700">Knowledge Graph / 知识图谱</h3>
                <span
                  class="text-[10px] font-mono text-amber-600/80 border border-amber-200 bg-amber-50 px-1 rounded inline-block mt-0.5"
                  >PENDING</span
                >
              </div>
            </div>
            <div
              class="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:8px_8px] opacity-20 pointer-events-none"
            />
          </div>
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
import { canChunkFile, isPlainTextFile } from '@renderer/stores/chunking/chunking.util'
import ChunkingPreviewDialog from '../SettingsView/ChunkingPreviewDialog.vue'
import type { ChunkingConfig } from '@renderer/stores/chunking/chunking.types'
import type { FileNode } from '../../types'

const props = defineProps<{
  fileKey: string
  knowledgeBaseId?: number
  fileData?: FileNode | null
}>()

const parsingStore = useParsingStore()
const chunkingStore = useChunkingStore()

// 分块配置（固定为段落分块模式）
const chunkingConfig = ref<ChunkingConfig>({
  mode: 'recursive',
  maxChars: 1000
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

const sections = [
  { id: 'document-parsing', label: '文档解析' },
  { id: 'chunking', label: '分块' },
  { id: 'embedding', label: '嵌入' },
  { id: 'knowledge-graph', label: '知识图谱' }
]

const activeSection = ref<string>(sections[0].id)
const contentRef = ref<HTMLElement | null>(null)
const documentParsingRef = ref<HTMLElement | null>(null)
const chunkingRef = ref<HTMLElement | null>(null)
const embeddingRef = ref<HTMLElement | null>(null)
const knowledgeGraphRef = ref<HTMLElement | null>(null)

const sectionRefs = {
  'document-parsing': documentParsingRef,
  chunking: chunkingRef,
  embedding: embeddingRef,
  'knowledge-graph': knowledgeGraphRef
}

let observer: IntersectionObserver | null = null

const scrollToSection = (sectionId: string): void => {
  activeSection.value = sectionId
  const sectionRef = sectionRefs[sectionId as keyof typeof sectionRefs]?.value
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
  [() => props.fileKey, () => chunkingConfig.value, () => canChunk.value],
  async ([key, config, canChunkFile]) => {
    if (!key || !canChunkFile) return
    await chunkingStore.ensureState(key, config)
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

  Object.keys(sectionRefs).forEach((sectionId) => {
    const ref = sectionRefs[sectionId as keyof typeof sectionRefs]?.value
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

  await parsingStore.startParsing(props.fileKey, {
    parserName: 'MinerU Parser',
    knowledgeBaseId: props.knowledgeBaseId
  })
}

const handleShowPreview = async (): Promise<void> => {
  if (!props.fileKey) return
  // 确保分块状态已加载
  await chunkingStore.ensureState(props.fileKey, chunkingConfig.value)
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

<template>
  <div class="KnowledgeView_KnowledgeDetail_DetailDrawer_tabContent">
    <!-- KnowledgeView_KnowledgeDetail_DetailDrawer_parseRoot: 解析状态Tab根容器（标注类，不负责样式） -->
    <div
      class="KnowledgeView_KnowledgeDetail_DetailDrawer_parseRoot h-full w-full bg-white text-slate-800 font-sans flex flex-col p-4 gap-4 overflow-hidden relative"
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

      <!-- KnowledgeView_KnowledgeDetail_DetailDrawer_comingSoon: ComingSoon区域（标注类，不负责样式） -->
      <div
        class="KnowledgeView_KnowledgeDetail_DetailDrawer_comingSoon flex flex-col gap-2 mt-auto"
      >
        <div class="flex items-center gap-2 px-1 mb-1 opacity-60">
          <div class="h-px bg-slate-200 flex-1" />
          <span class="text-[10px] font-mono text-slate-400 uppercase font-medium"
            >Coming Soon</span
          >
          <div class="h-px bg-slate-200 flex-1" />
        </div>

        <div
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
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <path d="M8 9h8" />
                <path d="M8 13h6" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-xs font-semibold text-slate-700">Semantic Chunking / 分块</h3>
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
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useParsingStore } from '@renderer/stores/parsing/parsing.store'

const props = defineProps<{
  fileKey: string
  knowledgeBaseId?: number
}>()

const parsingStore = useParsingStore()

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
</script>

<style scoped>
.KnowledgeView_KnowledgeDetail_DetailDrawer_tabContent {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}
</style>

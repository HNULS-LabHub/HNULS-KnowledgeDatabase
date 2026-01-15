<template>
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div v-if="visible" class="KnowledgeView_KnowledgeDetail_DetailDrawer_overlay" @click="close">
        <Transition name="drawer-slide">
          <div
            v-if="visible"
            class="KnowledgeView_KnowledgeDetail_DetailDrawer_container"
            @click.stop
          >
            <!-- Header -->
            <div class="KnowledgeView_KnowledgeDetail_DetailDrawer_header">
              <div class="KnowledgeView_KnowledgeDetail_DetailDrawer_headerLeft">
                <div class="KnowledgeView_KnowledgeDetail_DetailDrawer_fileIcon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14,2 14,8 20,8"></polyline>
                  </svg>
                </div>
                <div class="KnowledgeView_KnowledgeDetail_DetailDrawer_headerText">
                  <h3 class="KnowledgeView_KnowledgeDetail_DetailDrawer_title">
                    {{ fileData?.name || '文件详情' }}
                  </h3>
                  <span
                    v-if="fileData?.status"
                    class="KnowledgeView_KnowledgeDetail_DetailDrawer_statusBadge"
                    :class="`status-${fileData.status}`"
                  >
                    {{ statusText }}
                  </span>
                </div>
              </div>
              <button class="KnowledgeView_KnowledgeDetail_DetailDrawer_closeBtn" @click="close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <!-- Tabs -->
            <div class="KnowledgeView_KnowledgeDetail_DetailDrawer_tabs">
              <button
                v-for="tab in tabs"
                :key="tab.id"
                class="KnowledgeView_KnowledgeDetail_DetailDrawer_tabBtn"
                :class="{ active: currentTab === tab.id }"
                @click="currentTab = tab.id"
              >
                {{ tab.label }}
              </button>
            </div>

            <!-- Content -->
            <div class="KnowledgeView_KnowledgeDetail_DetailDrawer_content">
              <!-- Tab 1: 基本信息 -->
              <div
                v-if="currentTab === 'info'"
                class="KnowledgeView_KnowledgeDetail_DetailDrawer_tabContent"
              >
                <div class="info-section">
                  <h4 class="section-title">文件属性</h4>
                  <div class="info-grid">
                    <div class="info-item">
                      <span class="info-label">文件名</span>
                      <span class="info-value">{{ fileData?.name || '-' }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">大小</span>
                      <span class="info-value">{{ fileData?.size || '-' }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">类型</span>
                      <span class="info-value">{{ getTypeDisplay() }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">路径</span>
                      <span class="info-value truncate" :title="fileData?.path">
                        {{ fileData?.path || '-' }}
                      </span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">上传时间</span>
                      <span class="info-value">{{ fileData?.uploadTime || '-' }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">更新时间</span>
                      <span class="info-value">{{ fileData?.updateTime || '-' }}</span>
                    </div>
                    <div v-if="fileData?.metadata?.md5" class="info-item full-width">
                      <span class="info-label">MD5</span>
                      <span class="info-value code">{{ fileData.metadata.md5 }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Tab 2: 解析状态 -->
              <div
                v-else-if="currentTab === 'parse'"
                class="KnowledgeView_KnowledgeDetail_DetailDrawer_tabContent"
              >
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
                        <span
                          class="text-sm font-bold text-slate-800 flex items-center gap-2 min-w-0"
                        >
                          <svg
                            class="w-3.5 h-3.5 text-slate-500 shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <path
                              d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                            ></path>
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

                    <div
                      class="flex-1 overflow-y-auto p-2 space-y-1 relative bg-white"
                      ref="listRef"
                    >
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
                        <div
                          class="absolute left-[15px] top-0 bottom-0 w-[1px] bg-slate-200 -z-10"
                        />

                        <div
                          class="relative z-10 flex-shrink-0 flex items-center justify-center w-4"
                        >
                          <div
                            class="absolute rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                            :class="
                              activeVersionId === v.id
                                ? 'w-6 h-6 bg-blue-500/10'
                                : 'w-0 h-0 opacity-0'
                            "
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
                            :class="
                              activeVersionId === v.id ? 'text-blue-600/80' : 'text-slate-500'
                            "
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
                          <h3 class="text-xs font-semibold text-slate-700">
                            Semantic Chunking / 分块
                          </h3>
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
                          <h3 class="text-xs font-semibold text-slate-700">
                            Vector Embedding / 嵌入
                          </h3>
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
                          <h3 class="text-xs font-semibold text-slate-700">
                            Knowledge Graph / 知识图谱
                          </h3>
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

              <!-- Tab 3: 预览 -->
              <div
                v-else-if="currentTab === 'preview'"
                class="KnowledgeView_KnowledgeDetail_DetailDrawer_tabContent"
              >
                <div class="preview-placeholder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14,2 14,8 20,8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  <p>文件预览功能开发中...</p>
                  <span class="hint">支持 PDF、图片、文本等格式预览</span>
                </div>
              </div>
            </div>

            <!-- Footer Actions -->
            <div class="KnowledgeView_KnowledgeDetail_DetailDrawer_footer">
              <button
                class="footer-btn danger"
                :disabled="isDeleting || !fileData"
                @click="handleDelete"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18"></path>
                  <path
                    d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                  ></path>
                </svg>
                {{ isDeleting ? '删除中...' : '删除文件' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { FileNode } from '../types'
import { useFileListStore } from '@renderer/stores/knowledge-library/file-list.store'
import { useFileCardStore } from '@renderer/stores/knowledge-library/file-card.store'
import { useFileTreeStore } from '@renderer/stores/knowledge-library/file-tree.store'
import { useParsingStore } from '@renderer/stores/parsing/parsing.store'

const props = defineProps<{
  visible: boolean
  fileData?: FileNode | null
  knowledgeBaseId?: number
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'file-deleted'): void
}>()

const currentTab = ref<'info' | 'parse' | 'preview'>('info')
const isDeleting = ref(false)

const isParsing = ref(false)
const progress = ref(0)

const tabs = [
  { id: 'info' as const, label: '基本信息' },
  { id: 'parse' as const, label: '解析状态' },
  { id: 'preview' as const, label: '预览' }
]

const statusText = computed(() => {
  const statusMap = {
    parsed: '已解析',
    parsing: '解析中',
    failed: '解析失败',
    pending: '待解析'
  }
  return props.fileData?.status ? statusMap[props.fileData.status] : '未知'
})

const parsingStore = useParsingStore()

const fileKey = computed((): string => {
  if (!props.fileData) return ''
  return props.fileData.path || props.fileData.name || ''
})

const parsingState = computed(() => {
  if (!fileKey.value) return null
  return parsingStore.getState(fileKey.value)
})

const versions = computed(() => parsingState.value?.versions ?? [])

const activeVersionId = computed(() => parsingState.value?.activeVersionId ?? null)

watch(
  [() => props.visible, () => currentTab.value, () => fileKey.value],
  async ([visible, tab, key]) => {
    if (!visible) return
    if (tab !== 'parse') return
    if (!key) return
    await parsingStore.ensureState(key)
  },
  { immediate: true }
)

const handleSwitchVersion = (versionId: string) => {
  if (!fileKey.value) return
  if (!versionId) return
  parsingStore.switchActiveVersion(fileKey.value, versionId)
}

const handleStartParsing = async () => {
  if (!fileKey.value) return

  if (isParsing.value) return
  isParsing.value = true
  progress.value = 0

  await parsingStore.startParsing(fileKey.value, { parserName: 'MinerU Parser' })

  let currentProgress = 0
  const interval = window.setInterval(() => {
    currentProgress += Math.random() * 8
    if (currentProgress >= 100) {
      currentProgress = 100
      window.clearInterval(interval)
      window.setTimeout(() => {
        isParsing.value = false
      }, 800)
    }
    progress.value = currentProgress
  }, 150)
}

/**
 * 获取类型显示文本
 * 目录显示 'list'，文件显示扩展名，都没有则显示 '-'
 */
const getTypeDisplay = (): string => {
  if (!props.fileData) return '-'

  // 如果是目录，显示 'list'
  if (props.fileData.type === 'folder') {
    return 'list'
  }

  // 如果是文件，显示扩展名，没有扩展名则显示 '-'
  return props.fileData.extension || '-'
}

const close = (): void => {
  emit('update:visible', false)
  // Reset tab after animation
  setTimeout(() => {
    currentTab.value = 'info'
  }, 300)
}

// 获取各个 Store 实例
const fileListStore = useFileListStore()
const fileCardStore = useFileCardStore()
const fileTreeStore = useFileTreeStore()

const handleDelete = async (): Promise<void> => {
  if (!props.fileData || !props.knowledgeBaseId) {
    console.warn('[DetailDrawer] Cannot delete: missing fileData or knowledgeBaseId')
    return
  }

  // 确认删除
  const confirmed = window.confirm(`确定要删除 "${props.fileData.name}" 吗？\n\n此操作不可撤销。`)

  if (!confirmed) {
    return
  }

  isDeleting.value = true

  try {
    // 获取文件路径（相对路径）
    const filePath = props.fileData.path || props.fileData.name

    // 调用删除 API
    const result = await window.api.file.deleteFile(props.knowledgeBaseId, filePath)

    if (result.success) {
      // 刷新所有视图的文件列表
      await Promise.allSettled([
        fileListStore.fetchFiles(props.knowledgeBaseId),
        fileCardStore.fetchFiles(props.knowledgeBaseId),
        fileTreeStore.fetchFiles(props.knowledgeBaseId)
      ])

      // 关闭抽屉
      close()

      // 触发删除事件，通知父组件
      emit('file-deleted')
    } else {
      // 显示错误提示
      alert(`删除失败: ${result.error || '未知错误'}`)
    }
  } catch (error) {
    console.error('[DetailDrawer] Failed to delete file:', error)
    alert(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    isDeleting.value = false
  }
}
</script>

<style scoped>
/* Overlay */
.KnowledgeView_KnowledgeDetail_DetailDrawer_overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(2px);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}

/* Container */
.KnowledgeView_KnowledgeDetail_DetailDrawer_container {
  width: 480px;
  max-width: 90vw;
  height: 100%;
  background: white;
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
}

/* Header */
.KnowledgeView_KnowledgeDetail_DetailDrawer_header {
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-shrink: 0;
}

.KnowledgeView_KnowledgeDetail_DetailDrawer_headerLeft {
  display: flex;
  gap: 1rem;
  flex: 1;
  min-width: 0;
}

.KnowledgeView_KnowledgeDetail_DetailDrawer_fileIcon {
  width: 3rem;
  height: 3rem;
  background: #f8fafc;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  flex-shrink: 0;
}

.KnowledgeView_KnowledgeDetail_DetailDrawer_fileIcon svg {
  width: 1.5rem;
  height: 1.5rem;
}

.KnowledgeView_KnowledgeDetail_DetailDrawer_headerText {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.KnowledgeView_KnowledgeDetail_DetailDrawer_title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #0f172a;
  word-break: break-word;
  line-height: 1.4;
}

.KnowledgeView_KnowledgeDetail_DetailDrawer_statusBadge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  width: fit-content;
}

.status-parsed {
  background: #ecfdf5;
  color: #059669;
}

.status-parsing {
  background: #fef3c7;
  color: #d97706;
}

.status-failed {
  background: #fee2e2;
  color: #dc2626;
}

.status-pending {
  background: #f1f5f9;
  color: #64748b;
}

.KnowledgeView_KnowledgeDetail_DetailDrawer_closeBtn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #94a3b8;
  padding: 0.5rem;
  border-radius: 0.375rem;
  transition: all 200ms;
  flex-shrink: 0;
}

.KnowledgeView_KnowledgeDetail_DetailDrawer_closeBtn:hover {
  background: #f1f5f9;
  color: #475569;
}

.KnowledgeView_KnowledgeDetail_DetailDrawer_closeBtn svg {
  width: 1.25rem;
  height: 1.25rem;
}

/* Tabs */
.KnowledgeView_KnowledgeDetail_DetailDrawer_tabs {
  display: flex;
  padding: 0 1.5rem;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
}

.KnowledgeView_KnowledgeDetail_DetailDrawer_tabBtn {
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 200ms;
  position: relative;
  top: 1px;
}

.KnowledgeView_KnowledgeDetail_DetailDrawer_tabBtn:hover {
  color: #0f172a;
}

.KnowledgeView_KnowledgeDetail_DetailDrawer_tabBtn.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
}

/* Content */
.KnowledgeView_KnowledgeDetail_DetailDrawer_content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.KnowledgeView_KnowledgeDetail_DetailDrawer_tabContent {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.info-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #0f172a;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-grid {
  display: grid;
  gap: 1rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-item.full-width {
  grid-column: 1 / -1;
}

.info-label {
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 500;
}

.info-value {
  font-size: 0.875rem;
  color: #0f172a;
  word-break: break-word;
}

.info-value.code {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.75rem;
  background: #f8fafc;
  padding: 0.5rem;
  border-radius: 0.375rem;
  color: #475569;
}

.info-value.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Stat Cards */
.stat-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.stat-card {
  background: #f8fafc;
  border-radius: 0.75rem;
  padding: 1rem;
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.stat-icon {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon.blue {
  background: #dbeafe;
  color: #2563eb;
}

.stat-icon.green {
  background: #d1fae5;
  color: #059669;
}

.stat-icon svg {
  width: 1.25rem;
  height: 1.25rem;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: #0f172a;
}

.stat-label {
  font-size: 0.75rem;
  color: #64748b;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border: 1px solid #e2e8f0;
  background: white;
  color: #475569;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms;
}

.action-button:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.action-button.primary {
  background: #0f172a;
  color: white;
  border-color: #0f172a;
}

.action-button.primary:hover {
  background: #1e293b;
}

.action-button svg {
  width: 1rem;
  height: 1rem;
}

/* Preview Placeholder */
.preview-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  color: #94a3b8;
  text-align: center;
  gap: 1rem;
}

.preview-placeholder svg {
  width: 4rem;
  height: 4rem;
  opacity: 0.5;
}

.preview-placeholder p {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
}

.preview-placeholder .hint {
  font-size: 0.75rem;
  color: #cbd5e1;
}

/* Footer */
.KnowledgeView_KnowledgeDetail_DetailDrawer_footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #f1f5f9;
  flex-shrink: 0;
  background: #fafafa;
}

.footer-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.625rem 1rem;
  border: 1px solid #e2e8f0;
  background: white;
  color: #64748b;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms;
}

.footer-btn:hover {
  border-color: #cbd5e1;
}

.footer-btn.danger {
  color: #dc2626;
}

.footer-btn.danger:hover {
  background: #fef2f2;
  border-color: #fecaca;
}

.footer-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.footer-btn:disabled:hover {
  background: white;
  border-color: #e2e8f0;
}

.footer-btn svg {
  width: 1rem;
  height: 1rem;
}

/* Animations */
.drawer-fade-enter-active {
  transition: opacity 350ms cubic-bezier(0.4, 0, 0.2, 1);
}

.drawer-fade-leave-active {
  transition: opacity 250ms cubic-bezier(0.4, 0, 1, 1);
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

/* 从右向左插入的非线性动画 */
.drawer-slide-enter-active {
  transition: transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.drawer-slide-leave-active {
  transition: transform 300ms cubic-bezier(0.4, 0, 1, 1);
}

.drawer-slide-enter-from {
  transform: translateX(100%);
}

.drawer-slide-leave-to {
  transform: translateX(100%);
}
</style>

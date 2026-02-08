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
              <InfoTab v-if="currentTab === 'info'" :file-data="fileData" />

              <!-- Tab 2: 解析状态 -->
              <ParseTab
                v-else-if="currentTab === 'parse'"
                :file-key="fileKey"
                :knowledge-base-id="knowledgeBaseId"
                :file-data="fileData"
              />

              <!-- Tab 3: 预览 -->
              <PreviewTab v-else-if="currentTab === 'preview'" />
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
import { ref, computed } from 'vue'
import type { FileNode } from '@renderer/stores/knowledge-library/file.types'
import { useFileDataStore } from '@renderer/stores/knowledge-library/file-data.store'
import InfoTab from './InfoTab.vue'
import ParseTab from './ParseTab/index.vue'
import PreviewTab from './PreviewTab.vue'

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

const fileKey = computed((): string => {
  if (!props.fileData) return ''
  return props.fileData.path || props.fileData.name || ''
})

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

const close = (): void => {
  emit('update:visible', false)
  setTimeout(() => {
    currentTab.value = 'info'
  }, 300)
}

const fileDataStore = useFileDataStore()

const handleDelete = async (): Promise<void> => {
  if (!props.fileData || !props.knowledgeBaseId) {
    console.warn('[DetailDrawer] Cannot delete: missing fileData or knowledgeBaseId')
    return
  }

  const confirmed = window.confirm(`确定要删除 "${props.fileData.name}" 吗？\n\n此操作不可撤销。`)

  if (!confirmed) {
    return
  }

  isDeleting.value = true

  try {
    const filePath = props.fileData.path || props.fileData.name

    const result = await window.api.file.deleteFile(props.knowledgeBaseId, filePath)

    if (result.success) {
      await fileDataStore.refresh()

      close()

      emit('file-deleted')
    } else {
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

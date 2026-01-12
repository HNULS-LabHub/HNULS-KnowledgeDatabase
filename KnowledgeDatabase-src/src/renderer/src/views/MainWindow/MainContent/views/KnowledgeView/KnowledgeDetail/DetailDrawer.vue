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
                      <span class="info-value">{{ fileData?.extension || 'PDF' }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">路径</span>
                      <span class="info-value truncate" :title="fileData?.path">
                        {{ fileData?.path || '/documents/project/' }}
                      </span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">上传时间</span>
                      <span class="info-value">{{
                        fileData?.uploadTime || '2024-03-21 14:30'
                      }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">更新时间</span>
                      <span class="info-value">{{
                        fileData?.updateTime || '2024-03-21 14:30'
                      }}</span>
                    </div>
                    <div class="info-item full-width" v-if="fileData?.metadata?.md5">
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
                <div class="info-section">
                  <h4 class="section-title">解析统计</h4>
                  <div class="stat-cards">
                    <div class="stat-card">
                      <div class="stat-icon blue">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="3" y="3" width="7" height="7"></rect>
                          <rect x="14" y="3" width="7" height="7"></rect>
                          <rect x="14" y="14" width="7" height="7"></rect>
                          <rect x="3" y="14" width="7" height="7"></rect>
                        </svg>
                      </div>
                      <div class="stat-info">
                        <span class="stat-value">{{ fileData?.chunkCount || 128 }}</span>
                        <span class="stat-label">分块数量</span>
                      </div>
                    </div>
                    <div class="stat-card">
                      <div class="stat-icon green">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                        </svg>
                      </div>
                      <div class="stat-info">
                        <span class="stat-value">{{
                          fileData?.metadata?.tokenCount || '12.5k'
                        }}</span>
                        <span class="stat-label">Token 数量</span>
                      </div>
                    </div>
                  </div>

                  <div class="info-grid">
                    <div class="info-item">
                      <span class="info-label">解析模型</span>
                      <span class="info-value">{{
                        fileData?.metadata?.embeddingModel || 'text-embedding-3-small'
                      }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">解析耗时</span>
                      <span class="info-value">{{ fileData?.metadata?.parseTime || '2.3s' }}</span>
                    </div>
                  </div>
                </div>

                <div class="info-section">
                  <h4 class="section-title">操作</h4>
                  <div class="action-buttons">
                    <button class="action-button primary">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                      </svg>
                      重新解析
                    </button>
                    <button class="action-button">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      导出分块
                    </button>
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
import { ref, computed } from 'vue'
import type { FileNode } from '../types'
import { useFileListStore } from '@renderer/stores/knowledge-library/file-list.store'
import { useFileCardStore } from '@renderer/stores/knowledge-library/file-card.store'
import { useFileTreeStore } from '@renderer/stores/knowledge-library/file-tree.store'

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

const close = () => {
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

const handleDelete = async () => {
  if (!props.fileData || !props.knowledgeBaseId) {
    console.warn('[DetailDrawer] Cannot delete: missing fileData or knowledgeBaseId')
    return
  }

  // 确认删除
  const confirmed = window.confirm(
    `确定要删除 "${props.fileData.name}" 吗？\n\n此操作不可撤销。`
  )

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

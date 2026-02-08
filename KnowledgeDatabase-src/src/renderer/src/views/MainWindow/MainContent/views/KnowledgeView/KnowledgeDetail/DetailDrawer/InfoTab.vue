<template>
  <div class="KnowledgeView_KnowledgeDetail_DetailDrawer_tabContent">
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
</template>

<script setup lang="ts">
import type { FileNode } from '@renderer/stores/knowledge-library/file.types'

const props = defineProps<{
  fileData?: FileNode | null
}>()

/**
 * 获取类型显示文本
 * 目录显示 'list'，文件显示扩展名，都没有则显示 '-'
 */
const getTypeDisplay = (): string => {
  if (!props.fileData) return '-'

  if (props.fileData.type === 'folder') {
    return 'list'
  }

  return props.fileData.extension || '-'
}
</script>

<style scoped>
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
</style>

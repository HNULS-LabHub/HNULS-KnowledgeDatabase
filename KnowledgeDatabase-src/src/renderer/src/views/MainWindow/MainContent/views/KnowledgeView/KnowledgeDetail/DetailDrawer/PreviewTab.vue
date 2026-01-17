<template>
  <div class="KnowledgeView_KnowledgeDetail_DetailDrawer_tabContent">
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
</template>

<script setup lang="ts">
// PreviewTab 组件 - 文件预览功能
</script>

<style scoped>
.KnowledgeView_KnowledgeDetail_DetailDrawer_tabContent {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

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
</style>

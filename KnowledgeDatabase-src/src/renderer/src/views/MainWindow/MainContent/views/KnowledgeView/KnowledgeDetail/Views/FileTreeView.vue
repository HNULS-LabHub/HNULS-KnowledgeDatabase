<template>
  <div class="KnowledgeView_KnowledgeDetail_Views_FileTreeView_container">
    <!-- 模拟树形结构 -->
    <div v-for="folder in 3" :key="folder" class="tree-group">
      <div class="tree-item folder" @click="toggleFolder(folder)">
        <span class="toggle-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </span>
        <span class="icon folder-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
        </span>
        <span class="label">项目文档目录 {{ folder }}</span>
        <span class="meta">5 项</span>
      </div>

      <div class="tree-children">
        <div v-for="file in 5" :key="file" class="tree-item file">
          <span class="indent"></span>
          <span class="icon file-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
            </svg>
          </span>
          <span class="label">需求规格说明书-{{ folder }}-{{ file }}.pdf</span>
          <span class="meta-right">2.4 MB • 2024-03-21</span>
          
          <div class="tree-actions">
            <button class="action-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="19" cy="12" r="1"></circle>
                <circle cx="5" cy="12" r="1"></circle>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const toggleFolder = (id: number) => {
  // Mock toggle logic
  console.log('Toggle folder', id)
}
</script>

<style scoped>
.KnowledgeView_KnowledgeDetail_Views_FileTreeView_container {
  padding: 1rem 2rem;
}

.tree-item {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 150ms;
  gap: 0.5rem;
  color: #334155;
}

.tree-item:hover {
  background: #f1f5f9;
}

.tree-item.folder {
  font-weight: 500;
  color: #0f172a;
}

.toggle-icon {
  display: flex;
  align-items: center;
  color: #94a3b8;
  width: 1rem;
  justify-content: center;
}

.toggle-icon .chevron {
  width: 1rem;
  height: 1rem;
  transition: transform 200ms;
  transform: rotate(90deg); /* 默认展开 */
}

.icon {
  display: flex;
  align-items: center;
  color: #94a3b8;
}

.folder-icon { color: #3b82f6; }
.icon svg {
  width: 1.125rem;
  height: 1.125rem;
}

.label {
  flex: 1;
  font-size: 0.875rem;
}

.meta {
  font-size: 0.75rem;
  color: #94a3b8;
}

.tree-children {
  padding-left: 1rem;
  margin-left: 0.5rem;
  border-left: 1px solid #e2e8f0;
}

.indent {
  width: 1.5rem; /* Indentation for files */
}

.meta-right {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-right: 1rem;
}

.tree-actions {
  opacity: 0;
  transition: opacity 200ms;
}

.tree-item:hover .tree-actions {
  opacity: 1;
}

.action-btn {
  padding: 0.25rem;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #94a3b8;
  border-radius: 0.25rem;
}

.action-btn:hover {
  background: #e2e8f0;
  color: #475569;
}

.action-btn svg { width: 1rem; height: 1rem; }
</style>

<template>
  <div class="KnowledgeView_KnowledgeDetail_Views_FileListView_container">
    <table class="KnowledgeView_KnowledgeDetail_Views_FileListView_table">
      <thead>
        <tr>
          <th class="KnowledgeView_KnowledgeDetail_Views_FileListView_th name-col">名称</th>
          <th class="KnowledgeView_KnowledgeDetail_Views_FileListView_th">状态</th>
          <th class="KnowledgeView_KnowledgeDetail_Views_FileListView_th">大小</th>
          <th class="KnowledgeView_KnowledgeDetail_Views_FileListView_th">分块数</th>
          <th class="KnowledgeView_KnowledgeDetail_Views_FileListView_th">更新时间</th>
          <th class="KnowledgeView_KnowledgeDetail_Views_FileListView_th action-col"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="i in 15" :key="i" class="KnowledgeView_KnowledgeDetail_Views_FileListView_tr">
          <td class="KnowledgeView_KnowledgeDetail_Views_FileListView_td name-cell">
            <div class="file-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
              </svg>
            </div>
            <span class="file-name">技术架构说明书-V{{ i }}.0.pdf</span>
          </td>
          <td class="KnowledgeView_KnowledgeDetail_Views_FileListView_td">
            <span class="status-badge success">已解析</span>
          </td>
          <td class="KnowledgeView_KnowledgeDetail_Views_FileListView_td">2.4 MB</td>
          <td class="KnowledgeView_KnowledgeDetail_Views_FileListView_td">128</td>
          <td class="KnowledgeView_KnowledgeDetail_Views_FileListView_td">2024-03-21 14:30</td>
          <td class="KnowledgeView_KnowledgeDetail_Views_FileListView_td action-cell">
            <div class="action-buttons">
              <button class="action-btn" title="详情">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              </button>
              <button class="action-btn delete" title="删除">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.KnowledgeView_KnowledgeDetail_Views_FileListView_container {
  padding: 0 2rem 2rem 2rem;
}

.KnowledgeView_KnowledgeDetail_Views_FileListView_table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.KnowledgeView_KnowledgeDetail_Views_FileListView_th {
  text-align: left;
  padding: 1rem;
  color: #64748b;
  font-weight: 500;
  border-bottom: 1px solid #e2e8f0;
  background: rgba(255, 255, 255, 0.9);
  position: sticky;
  top: 73px; /* ContentHeader height + padding */
  z-index: 5;
  backdrop-filter: blur(8px);
}

.KnowledgeView_KnowledgeDetail_Views_FileListView_tr {
  transition: background 150ms;
  border-bottom: 1px solid #f1f5f9;
}

.KnowledgeView_KnowledgeDetail_Views_FileListView_tr:hover {
  background: #f8fafc;
}

.KnowledgeView_KnowledgeDetail_Views_FileListView_td {
  padding: 0.875rem 1rem;
  color: #334155;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 500;
  color: #0f172a;
}

.file-icon {
  color: #94a3b8;
  display: flex;
  align-items: center;
}

.file-icon svg {
  width: 1.25rem;
  height: 1.25rem;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.success {
  background: #ecfdf5;
  color: #059669;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  opacity: 0;
  transition: opacity 200ms;
}

.KnowledgeView_KnowledgeDetail_Views_FileListView_tr:hover .action-buttons {
  opacity: 1;
}

.action-btn {
  padding: 0.25rem;
  color: #94a3b8;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  background: #e2e8f0;
  color: #475569;
}

.action-btn.delete:hover {
  background: #fee2e2;
  color: #ef4444;
}

.action-btn svg {
  width: 1rem;
  height: 1rem;
}
</style>

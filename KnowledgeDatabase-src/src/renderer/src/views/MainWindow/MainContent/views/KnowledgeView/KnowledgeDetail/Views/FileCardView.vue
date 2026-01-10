<template>
  <div class="KnowledgeView_KnowledgeDetail_Views_FileCardView_container">
    <div v-for="i in 10" :key="i" class="KnowledgeView_KnowledgeDetail_Views_FileCardView_card">
      <div class="KnowledgeView_KnowledgeDetail_Views_FileCardView_icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14,2 14,8 20,8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      </div>
      <div class="KnowledgeView_KnowledgeDetail_Views_FileCardView_content">
        <h3 class="KnowledgeView_KnowledgeDetail_Views_FileCardView_title">产品需求文档-V{{ i }}.0.pdf</h3>
        <div class="KnowledgeView_KnowledgeDetail_Views_FileCardView_meta">
          <span>2.4 MB</span>
          <span>•</span>
          <span>2024-03-21</span>
        </div>
      </div>
      <div class="KnowledgeView_KnowledgeDetail_Views_FileCardView_footer">
        <div class="KnowledgeView_KnowledgeDetail_Views_FileCardView_status">
          <span class="status-dot"></span>
          已解析
        </div>
        <button class="KnowledgeView_KnowledgeDetail_Views_FileCardView_moreBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="19" cy="12" r="1"></circle>
            <circle cx="5" cy="12" r="1"></circle>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.KnowledgeView_KnowledgeDetail_Views_FileCardView_container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.5rem;
  padding: 1.5rem 2rem;
}

.KnowledgeView_KnowledgeDetail_Views_FileCardView_card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  overflow: hidden;
  transition: all 200ms;
  display: flex;
  flex-direction: column;
}

.KnowledgeView_KnowledgeDetail_Views_FileCardView_card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
  border-color: #cbd5e1;
}

.KnowledgeView_KnowledgeDetail_Views_FileCardView_icon {
  height: 80px;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  border-bottom: 1px solid #f1f5f9;
}

.KnowledgeView_KnowledgeDetail_Views_FileCardView_icon svg {
  width: 2.5rem;
  height: 2.5rem;
}

.KnowledgeView_KnowledgeDetail_Views_FileCardView_content {
  padding: 1rem;
  flex: 1;
}

.KnowledgeView_KnowledgeDetail_Views_FileCardView_title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 0.5rem 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}

.KnowledgeView_KnowledgeDetail_Views_FileCardView_meta {
  font-size: 0.75rem;
  color: #94a3b8;
  display: flex;
  gap: 0.5rem;
}

.KnowledgeView_KnowledgeDetail_Views_FileCardView_footer {
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border-top: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.KnowledgeView_KnowledgeDetail_Views_FileCardView_status {
  font-size: 0.75rem;
  color: #10b981;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-weight: 500;
}

.status-dot {
  width: 0.375rem;
  height: 0.375rem;
  background: #10b981;
  border-radius: 50%;
}

.KnowledgeView_KnowledgeDetail_Views_FileCardView_moreBtn {
  padding: 0.25rem;
  color: #94a3b8;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 0.25rem;
  display: flex;
  align-items: center;
}

.KnowledgeView_KnowledgeDetail_Views_FileCardView_moreBtn:hover {
  background: #e2e8f0;
  color: #475569;
}

.KnowledgeView_KnowledgeDetail_Views_FileCardView_moreBtn svg {
  width: 1rem;
  height: 1rem;
}
</style>

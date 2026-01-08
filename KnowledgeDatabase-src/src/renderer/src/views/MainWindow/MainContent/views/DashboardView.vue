<template>
  <div class="dashboard-view">
    <div class="dashboard-header">
      <div>
        <h1 class="page-title">早安, 管理员</h1>
        <p class="page-subtitle">今日系统概况与知识库健康度监控。</p>
      </div>
      <div class="header-actions">
        <button class="action-btn secondary">导出报表</button>
        <button class="action-btn primary">系统优化</button>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="glass-card stat-card">
        <div class="stat-header">
          <div class="stat-icon blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
            </svg>
          </div>
          <span class="stat-change">
            <svg class="activity-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            +12%
          </span>
        </div>
        <div class="stat-value">1,284</div>
        <div class="stat-label">Total Documents</div>
      </div>

      <div class="glass-card stat-card">
        <div class="stat-header">
          <div class="stat-icon purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
            </svg>
          </div>
          <span class="stat-change">
            <svg class="activity-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            +840
          </span>
        </div>
        <div class="stat-value">84.5k</div>
        <div class="stat-label">Vector Chunks</div>
      </div>

      <div class="glass-card stat-card">
        <div class="stat-header">
          <div class="stat-icon emerald">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="18" cy="18" r="3"></circle>
              <circle cx="6" cy="6" r="3"></circle>
              <circle cx="6" cy="18" r="3"></circle>
              <line x1="8.59" y1="7.41" x2="15.42" y2="16.59"></line>
              <line x1="8.59" y1="16.59" x2="15.42" y2="7.41"></line>
            </svg>
          </div>
          <span class="stat-change">
            <svg class="activity-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            +5%
          </span>
        </div>
        <div class="stat-value">12,903</div>
        <div class="stat-label">Graph Nodes</div>
      </div>
    </div>

    <!-- Recent Activity -->
    <h3 class="section-title">
      <svg class="title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
      最近活动
    </h3>
    <div class="activity-list">
      <div v-for="i in 3" :key="i" class="activity-item">
        <div class="activity-icon-wrapper">
          <svg class="activity-file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
          </svg>
        </div>
        <div class="activity-content">
          <h4 class="activity-title">系统自动索引了 4 个新文件</h4>
          <p class="activity-time">Project_Alpha_Specs.pdf • 2 分钟前</p>
        </div>
        <button class="activity-more">
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

<script setup lang="ts">
// Dashboard logic
</script>

<style scoped>
.dashboard-view {
  padding: 2rem;
  animation: fadeIn 500ms;
  overflow-y: auto;
  height: 100%;
  box-sizing: border-box;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(1rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 2rem;
}

.page-title {
  font-size: 1.875rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 0.5rem 0;
}

.page-subtitle {
  color: #64748b;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 300ms;
  border: none;
}

.action-btn.secondary {
  background: white;
  border: 1px solid #e2e8f0;
  color: #475569;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.action-btn.secondary:hover {
  color: #0f172a;
}

.action-btn.primary {
  background: #0f172a;
  color: white;
  box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.3);
}

.action-btn.primary:hover {
  background: #1e293b;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.glass-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(48px);
  border: 1px solid rgba(226, 232, 240, 0.6);
  border-radius: 1rem;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  transition: all 300ms;
}

.glass-card:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border-color: rgba(199, 210, 254, 0.5);
}

.stat-card {
  padding: 1.5rem;
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.stat-icon {
  padding: 0.75rem;
  border-radius: 0.75rem;
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon svg {
  width: 1.5rem;
  height: 1.5rem;
}

.stat-icon.blue {
  background: #eff6ff;
  color: #2563eb;
}

.stat-icon.purple {
  background: #faf5ff;
  color: #7c3aed;
}

.stat-icon.emerald {
  background: #ecfdf5;
  color: #10b981;
}

.stat-change {
  font-size: 0.75rem;
  font-weight: 700;
  color: #10b981;
  background: #ecfdf5;
  border: 1px solid #d1fae5;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.activity-icon {
  width: 0.75rem;
  height: 0.75rem;
}

.stat-value {
  font-size: 1.875rem;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 0.25rem;
}

.stat-label {
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 500;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 1rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.title-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #f59e0b;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-radius: 0.75rem;
  background: white;
  border: 1px solid #f1f5f9;
  cursor: pointer;
  transition: all 300ms;
}

.activity-item:hover {
  border-color: #c7d2fe;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.activity-icon-wrapper {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 9999px;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  transition: all 300ms;
}

.activity-item:hover .activity-icon-wrapper {
  background: #eef2ff;
  color: #4f46e5;
}

.activity-file-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.activity-content {
  flex: 1;
}

.activity-title {
  color: #0f172a;
  font-size: 0.875rem;
  font-weight: 700;
  margin: 0 0 0.125rem 0;
  transition: color 300ms;
}

.activity-item:hover .activity-title {
  color: #4f46e5;
}

.activity-time {
  color: #64748b;
  font-size: 0.75rem;
  margin: 0;
}

.activity-more {
  padding: 0.5rem;
  color: #cbd5e1;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 300ms;
}

.activity-more:hover {
  color: #475569;
}

.activity-more svg {
  width: 1.25rem;
  height: 1.25rem;
}
</style>
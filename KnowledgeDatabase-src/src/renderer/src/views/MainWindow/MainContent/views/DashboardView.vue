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
            <svg
              class="activity-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
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
            <svg
              class="activity-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
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
            <svg
              class="activity-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
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
      <svg
        class="title-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
      最近活动
    </h3>
    <div class="activity-list">
      <div v-for="i in 3" :key="i" class="activity-item">
        <div class="activity-icon-wrapper">
          <svg
            class="activity-file-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
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
/* 所有样式已迁移到全局 tailwind.css 中的组件类 */
</style>

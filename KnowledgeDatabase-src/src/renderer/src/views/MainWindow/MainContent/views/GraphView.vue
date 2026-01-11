<template>
  <div class="graph-view">
    <div class="graph-header">
      <div>
        <h2 class="page-title">
          <svg
            class="title-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="18" cy="18" r="3"></circle>
            <circle cx="6" cy="6" r="3"></circle>
            <circle cx="6" cy="18" r="3"></circle>
            <line x1="8.59" y1="7.41" x2="15.42" y2="16.59"></line>
            <line x1="8.59" y1="16.59" x2="15.42" y2="7.41"></line>
          </svg>
          Graph RAG 知识图谱
        </h2>
        <p class="page-subtitle">实体关系挖掘与多跳推理可视化。</p>
      </div>
      <button class="add-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        新增实体
      </button>
    </div>

    <div class="glass-card graph-container">
      <!-- Legend -->
      <div class="legend">
        <div class="legend-item">
          <svg
            class="legend-icon blue"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          </svg>
          <span>Concept</span>
        </div>
        <div class="legend-item">
          <svg
            class="legend-icon purple"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
          </svg>
          <span>Document</span>
        </div>
        <div class="legend-item">
          <svg
            class="legend-icon emerald"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span>Person</span>
        </div>
      </div>

      <!-- SVG Graph -->
      <svg class="graph-svg" viewBox="0 0 800 500">
        <defs>
          <marker
            id="arrow"
            markerWidth="10"
            markerHeight="10"
            refX="24"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="#94a3b8" />
          </marker>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <!-- Edges -->
        <g class="edges">
          <line x1="400" y1="250" x2="250" y2="150" class="edge pulse-1" marker-end="url(#arrow)" />
          <line x1="400" y1="250" x2="550" y2="150" class="edge pulse-2" marker-end="url(#arrow)" />
          <line x1="400" y1="250" x2="400" y2="400" class="edge pulse-3" marker-end="url(#arrow)" />
          <line x1="250" y1="150" x2="150" y2="250" class="edge dashed" marker-end="url(#arrow)" />
          <line x1="550" y1="150" x2="650" y2="250" class="edge dashed" marker-end="url(#arrow)" />
        </g>

        <!-- Nodes -->
        <g class="nodes">
          <!-- Center Node -->
          <circle cx="400" cy="250" r="30" class="node-circle center" filter="url(#glow)">
            <animate attributeName="r" values="30;32;30" dur="4s" repeatCount="indefinite" />
          </circle>
          <foreignObject x="388" y="238" width="24" height="24">
            <div class="node-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path
                  d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"
                ></path>
              </svg>
            </div>
          </foreignObject>
          <text x="400" y="300" class="node-label">AI Model</text>

          <!-- Top Left -->
          <circle cx="250" cy="150" r="22" class="node-circle purple" />
          <foreignObject x="240" y="140" width="20" height="20">
            <div class="node-icon small">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="4" y="4" width="6" height="6" rx="1"></rect>
              </svg>
            </div>
          </foreignObject>
          <text x="250" y="115" class="node-label small">Neural Net</text>

          <!-- Top Right -->
          <circle cx="550" cy="150" r="22" class="node-circle emerald" />
          <foreignObject x="540" y="140" width="20" height="20">
            <div class="node-icon small">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
              </svg>
            </div>
          </foreignObject>
          <text x="550" y="115" class="node-label small">Training Data</text>

          <!-- Bottom -->
          <circle cx="400" cy="400" r="25" class="node-circle amber" />
          <foreignObject x="390" y="390" width="20" height="20">
            <div class="node-icon small">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
            </div>
          </foreignObject>
          <text x="400" y="445" class="node-label small">Inference</text>
        </g>
      </svg>

      <!-- Info Panel -->
      <div class="info-panel">
        <h4 class="info-title">
          <svg
            class="info-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"
            ></path>
          </svg>
          当前选中: AI Model
        </h4>
        <div class="info-content">
          <div class="info-row">
            <span>Degree:</span>
            <span class="info-value">12</span>
          </div>
          <div class="info-row">
            <span>Cluster:</span>
            <span class="info-value">Main_Entity_01</span>
          </div>
          <div class="info-description">
            <p>中心节点，连接神经网络架构与训练数据集，是推理路径的核心枢纽。</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Graph view logic
</script>

<style scoped>
/* 所有样式已迁移到全局 tailwind.css 中的组件类 */
/* SVG 相关样式保留在组件中，因为它们是 SVG 特定的 */
</style>

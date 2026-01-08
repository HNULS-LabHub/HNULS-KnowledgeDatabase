<template>
  <div class="graph-view">
    <div class="graph-header">
      <div>
        <h2 class="page-title">
          <svg class="title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
          <svg class="legend-icon blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          </svg>
          <span>Concept</span>
        </div>
        <div class="legend-item">
          <svg class="legend-icon purple" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
          </svg>
          <span>Document</span>
        </div>
        <div class="legend-item">
          <svg class="legend-icon emerald" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span>Person</span>
        </div>
      </div>

      <!-- SVG Graph -->
      <svg class="graph-svg" viewBox="0 0 800 500">
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="24" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="#94a3b8" />
          </marker>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
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
                <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"></path>
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
          <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"></path>
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
.graph-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 2rem;
  animation: fadeIn 500ms;
  overflow-y: auto;
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

.graph-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 0.25rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.title-icon {
  width: 1.5rem;
  height: 1.5rem;
  color: #94a3b8;
}

.page-subtitle {
  color: #64748b;
  margin: 0;
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 300ms;
  box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.3);
}

.add-btn:hover {
  background: #4338ca;
}

.add-btn svg {
  width: 1rem;
  height: 1rem;
}

.glass-card {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: rgba(248, 250, 252, 0.5);
  backdrop-filter: blur(48px);
  border: 1px solid rgba(226, 232, 240, 0.6);
  border-radius: 1rem;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.graph-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.legend {
  position: absolute;
  top: 1rem;
  left: 1rem;
  z-index: 10;
  display: flex;
  gap: 0.5rem;
}

.legend-item {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  padding: 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
  font-size: 0.75rem;
  color: #475569;
  font-weight: 500;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.legend-icon {
  width: 1rem;
  height: 1rem;
}

.legend-icon.blue {
  color: #2563eb;
}

.legend-icon.purple {
  color: #7c3aed;
}

.legend-icon.emerald {
  color: #10b981;
}

.graph-svg {
  width: 100%;
  height: 100%;
}

.edges {
  stroke: #cbd5e1;
  stroke-width: 1.5;
}

.edge.pulse-1 {
  animation: pulse 3s infinite;
}

.edge.pulse-2 {
  animation: pulse 4s infinite;
}

.edge.pulse-3 {
  animation: pulse 5s infinite;
}

.edge.dashed {
  opacity: 0.6;
  stroke-dasharray: 5,5;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.node-circle {
  cursor: pointer;
  transition: all 300ms;
  stroke-width: 2;
}

.node-circle.center {
  fill: #eff6ff;
  stroke: #3b82f6;
}

.node-circle.purple {
  fill: #faf5ff;
  stroke: #a855f7;
}

.node-circle.emerald {
  fill: #ecfdf5;
  stroke: #10b981;
}

.node-circle.amber {
  fill: #fffbeb;
  stroke: #f59e0b;
}

.node-circle:hover {
  opacity: 0.9;
}

.node-icon {
  color: #2563eb;
}

.node-icon svg {
  width: 100%;
  height: 100%;
}

.node-icon.small {
  color: inherit;
}

.node-label {
  text-anchor: middle;
  fill: #64748b;
  font-size: 12px;
  font-weight: 600;
}

.node-label.small {
  font-size: 11px;
  font-weight: 500;
}

.info-panel {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  padding: 1rem;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  width: 16rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  transform: translateY(0.5rem);
  opacity: 0.9;
  transition: all 300ms;
}

.info-panel:hover {
  opacity: 1;
  transform: translateY(0);
}

.info-title {
  color: #0f172a;
  font-size: 0.875rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.info-icon {
  width: 1rem;
  height: 1rem;
  color: #2563eb;
}

.info-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #64748b;
}

.info-row {
  display: flex;
  justify-content: space-between;
}

.info-value {
  color: #0f172a;
  font-family: monospace;
}

.info-description {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  color: #475569;
  line-height: 1.5;
}

.info-description p {
  margin: 0;
}
</style>
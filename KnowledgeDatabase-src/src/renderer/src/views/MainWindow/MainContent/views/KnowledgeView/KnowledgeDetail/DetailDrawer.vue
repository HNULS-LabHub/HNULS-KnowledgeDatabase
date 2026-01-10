<template>
  <div class="KnowledgeView_KnowledgeDetail_DetailDrawer_overlay" v-if="visible" @click="close">
    <div class="KnowledgeView_KnowledgeDetail_DetailDrawer_container" @click.stop>
      <div class="KnowledgeView_KnowledgeDetail_DetailDrawer_header">
        <h3 class="KnowledgeView_KnowledgeDetail_DetailDrawer_title">文件详情</h3>
        <button class="KnowledgeView_KnowledgeDetail_DetailDrawer_closeBtn" @click="close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="KnowledgeView_KnowledgeDetail_DetailDrawer_content">
        <!-- 占位内容 -->
        <p>详细信息内容区...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
}>()

const close = () => {
  emit('update:visible', false)
}
</script>

<style scoped>
.KnowledgeView_KnowledgeDetail_DetailDrawer_overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.2);
  z-index: 100;
  display: flex;
  justify-content: flex-end;
}

.KnowledgeView_KnowledgeDetail_DetailDrawer_container {
  width: 400px;
  height: 100%;
  background: white;
  box-shadow: -4px 0 15px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
}

.KnowledgeView_KnowledgeDetail_DetailDrawer_header {
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.KnowledgeView_KnowledgeDetail_DetailDrawer_title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #0f172a;
}

.KnowledgeView_KnowledgeDetail_DetailDrawer_closeBtn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #94a3b8;
  padding: 0.25rem;
  border-radius: 0.25rem;
}

.KnowledgeView_KnowledgeDetail_DetailDrawer_closeBtn:hover {
  background: #f1f5f9;
  color: #475569;
}

.KnowledgeView_KnowledgeDetail_DetailDrawer_closeBtn svg {
  width: 1.25rem;
  height: 1.25rem;
}

.KnowledgeView_KnowledgeDetail_DetailDrawer_content {
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
}
</style>

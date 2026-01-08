<template>
  <div class="welcome-screen" :class="{ mounted: isMounted }">
    <!-- Background Ambience -->
    <div class="background-ambience">
      <div class="bg-blob bg-blob-1"></div>
      <div class="bg-blob bg-blob-2"></div>
    </div>

    <div class="welcome-content">
      <div class="logo-section">
        <div class="logo-box">
          <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"></path>
            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"></path>
          </svg>
        </div>
        <h1 class="app-title">
          Nexus <span class="gradient-text">Mind</span>
        </h1>
        <p class="app-subtitle">
          <br/>融合 RAG 与 Graph Reasoning 的智能引擎。
        </p>
      </div>

      <button class="enter-button" @click="handleEnter">
        <span class="button-content">
          初始化系统
          <svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </span>
      </button>
    </div>
    
    <div class="bottom-hint">
      按 <span class="key-hint">Space</span> 快速进入
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const emit = defineEmits<{
  enterApp: []
}>()

const isMounted = ref(false)

onMounted(() => {
  setTimeout(() => {
    isMounted.value = true
  }, 100)
})

const handleEnter = () => {
  isMounted.value = false
  setTimeout(() => {
    emit('enterApp')
  }, 600)
}
</script>

<style scoped>
.welcome-screen {
  position: fixed;
  inset: 0;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  z-index: 50;
  color: #0f172a;
}

.background-ambience {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.bg-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  mix-blend-mode: multiply;
  transition: all 1000ms;
  opacity: 0;
  transform: translateY(10px);
}

.mounted .bg-blob {
  opacity: 1;
  transform: translateY(0);
}

.bg-blob-1 {
  top: -20%;
  left: -10%;
  width: 600px;
  height: 600px;
  background: rgba(199, 210, 254, 0.4);
}

.bg-blob-2 {
  bottom: -20%;
  right: -10%;
  width: 500px;
  height: 500px;
  background: rgba(221, 214, 254, 0.4);
  transition-delay: 300ms;
}

.welcome-content {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 0 1rem;
}

.logo-section {
  margin-bottom: 2.5rem;
  transition: all 700ms;
  transition-delay: 100ms;
  opacity: 0;
  transform: translateY(2rem);
}

.mounted .logo-section {
  opacity: 1;
  transform: translateY(0);
}

.logo-box {
  width: 5rem;
  height: 5rem;
  background: white;
  border-radius: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);
  margin: 0 auto 2rem;
  transform: rotate(3deg);
  transition: transform 300ms;
  border: 1px solid #f1f5f9;
}

.logo-box:hover {
  transform: rotate(6deg);
}

.logo-icon {
  width: 2.5rem;
  height: 2.5rem;
  color: #4f46e5;
}

.app-title {
  font-size: 4.5rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  margin-bottom: 1.5rem;
  color: #0f172a;
}

.gradient-text {
  background: linear-gradient(to right, #4f46e5, #7c3aed);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.app-subtitle {
  color: #64748b;
  font-size: 1.25rem;
  max-width: 32rem;
  margin: 0 auto;
  line-height: 1.75;
}

.enter-button {
  position: relative;
  padding: 1rem 2rem;
  background: #0f172a;
  color: white;
  border: none;
  border-radius: 9999px;
  font-weight: 600;
  font-size: 1.125rem;
  cursor: pointer;
  transition: all 500ms;
  overflow: hidden;
  opacity: 0;
  transform: translateY(2rem);
}

.mounted .enter-button {
  opacity: 1;
  transform: translateY(0);
}

.enter-button:hover {
  background: #1e293b;
  transform: scale(1.05);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.button-content {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.arrow-icon {
  width: 1.25rem;
  height: 1.25rem;
  transition: transform 300ms;
}

.enter-button:hover .arrow-icon {
  transform: translateX(0.25rem);
}

.bottom-hint {
  position: absolute;
  bottom: 2.5rem;
  color: #94a3b8;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.key-hint {
  background: white;
  border: 1px solid #e2e8f0;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  color: #475569;
  font-family: monospace;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

@media (max-width: 768px) {
  .app-title {
    font-size: 3rem;
  }
  
  .app-subtitle {
    font-size: 1rem;
  }
}
</style>
<script setup lang="ts">
import { ref } from 'vue';

const pingResult = ref<string>('');

const handlePing = async (): Promise<void> => {
  try {
    const result = await window.api.test.ping();
    pingResult.value = `${result.message} (${new Date(result.timestamp).toLocaleTimeString()})`;
  } catch (error) {
    pingResult.value = `Error: ${error}`;
  }
};
</script>

<template>
  <div class="container">
    <h1>Knowledge Database</h1>
    <div class="creator">Powered by electron-vite</div>
    <p class="tip">Press <code>F12</code> to open DevTools</p>
    <div class="actions">
      <button @click="handlePing">Test IPC Ping</button>
    </div>
    <p v-if="pingResult" class="result">IPC Result: {{ pingResult }}</p>
  </div>
</template>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  font-family: system-ui, -apple-system, sans-serif;
}

h1 {
  color: #42b883;
  margin-bottom: 0.5rem;
}

.creator {
  color: #666;
  margin-bottom: 2rem;
}

.tip {
  color: #888;
  font-size: 0.9rem;
}

code {
  background: #f4f4f4;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
}

.actions {
  margin: 1.5rem 0;
}

button {
  padding: 0.6rem 1.2rem;
  font-size: 1rem;
  background: #42b883;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

button:hover {
  background: #369970;
}

.result {
  margin-top: 1rem;
  padding: 0.8rem 1.2rem;
  background: #f0f9f4;
  border-radius: 6px;
  color: #2c3e50;
}
</style>

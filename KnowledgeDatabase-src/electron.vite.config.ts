import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
// 共享路径别名
const sharedAlias = {
  '@shared': resolve(__dirname, 'src/Public/ShareTypes'),
  '@shared-utils': resolve(__dirname, 'src/Public/SharedUtils')
}

export default defineConfig({
  main: {
    resolve: {
      alias: sharedAlias
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          'utility/embedding': resolve(__dirname, 'src/utility/embedding-engine/entry.ts'),
          'utility/global-monitor': resolve(__dirname, 'src/utility/global-monitor/entry.ts'),
          'utility/vector-indexer': resolve(__dirname, 'src/utility/vector-indexer/entry.ts'),
          'utility/api-server': resolve(__dirname, 'src/utility/api-server/entry.ts')
        }
      }
    }
  },
  preload: {
    resolve: {
      alias: sharedAlias
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        ...sharedAlias
      }
    },
    plugins: [vue()]
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      }
    },
    lib: {
      entry: path.resolve(__dirname, 'src/lib/widget-loader.tsx'),
      name: 'UserBirdWidget',
      fileName: 'widget',
      formats: ['iife']
    }
  }
})
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
        widget: path.resolve(__dirname, 'src/lib/widget-loader.tsx')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === 'widget' ? 'widget.bundle.js' : '[name].[hash].js'
        },
        format: 'iife', // This ensures the widget bundle is built as a regular script
      }
    }
  }
})
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  publicDir: 'public',
  server: {
    port: 6789,
    proxy: {
      '/api': {
        target: 'http://localhost:5678',
        changeOrigin: true,
      },
      '/export': {
        target: 'http://localhost:5678',
        changeOrigin: true,
      },
    },
  },
})

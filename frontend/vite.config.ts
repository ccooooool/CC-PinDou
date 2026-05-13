import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function getPackageName(id: string): string | undefined {
  const parts = id.split('node_modules/')
  const sub = parts.pop()
  if (!sub) return undefined
  // 处理 @scope/pkg 格式
  const first = sub.split('/')[0]
  if (first.startsWith('@')) {
    return `${first}/${sub.split('/')[1]}`
  }
  return first
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  publicDir: 'public',
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            const pkg = getPackageName(id)

            // React 核心生态
            if (
              pkg === 'react' ||
              pkg === 'react-dom' ||
              pkg === 'react-router-dom'
            ) {
              return 'vendor-react'
            }
            // 动画库
            if (pkg === 'framer-motion') {
              return 'vendor-motion'
            }
            // Radix UI 组件库（统一打包，避免过多小 chunk）
            if (pkg?.startsWith('@radix-ui')) {
              return 'vendor-radix'
            }
            // 图标
            if (pkg === 'lucide-react') {
              return 'vendor-icons'
            }
            // 状态管理
            if (pkg === 'zustand' || pkg === 'immer') {
              return 'vendor-state'
            }
            // 工具库（tailwind 相关）
            if (
              pkg === 'tailwind-merge' ||
              pkg === 'clsx' ||
              pkg === 'class-variance-authority'
            ) {
              return 'vendor-tw'
            }
            // 通知组件
            if (pkg === 'sonner') {
              return 'vendor-sonner'
            }
            // 图片裁剪
            if (pkg === 'cropperjs') {
              return 'vendor-cropper'
            }
            // Excel 处理库（动态导入，体积较大）
            if (pkg === 'xlsx') {
              return 'vendor-xlsx'
            }
            // 其余不单独拆分，由 Rollup 自动处理
          }
          // 业务引擎（颜色匹配、网格生成等重计算模块）
          if (id.includes('/src/engine/')) {
            return 'engine'
          }
        },
      },
    },
  },
  server: {
    host: true,
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

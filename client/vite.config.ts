import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3000',
      '/connect': 'http://localhost:3000',
      '/callback': 'http://localhost:3000',
    },
  },
  build: {
    outDir: '../public-dist',
    emptyOutDir: true,
    cssMinify: 'esbuild',
  },
})

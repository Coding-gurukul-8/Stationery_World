import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendTarget = 'https://stationery-world.onrender.com'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Dev proxy: forward /api calls to backend so Vite doesn't return index.html (which causes JSON parse errors)
  base: "/",
  server: {
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        secure: false
      }
    }
  }
})

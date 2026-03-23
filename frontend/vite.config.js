import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Dev proxy: forward /api calls to backend at :3000 so Vite doesn't return index.html (which causes JSON parse errors)
  base: process.env.VITE_BASE_PATH || "/",
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})

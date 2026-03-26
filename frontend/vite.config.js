import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '');
  const backendTarget = env.VITE_API_URL || 'https://stationery-world.onrender.com';

  return {
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
  };
});

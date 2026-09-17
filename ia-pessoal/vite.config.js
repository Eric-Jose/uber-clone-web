import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Permite o host do preview (e2b.app) e qualquer origem em dev
    allowedHosts: true,
    cors: true,
    hmr: { clientPort: 443 }
  }
})

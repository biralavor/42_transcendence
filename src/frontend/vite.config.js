import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,  // bind to 0.0.0.0 so nginx can reach it inside Docker
    port: parseInt(process.env.FRONTEND_PORT) || 3000,
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
})

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
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.js'],
    // Generous timeout absorbs slow React/jsdom waitFor() under Docker on WSL2.
    // Attempts to serialize (singleThread / singleFork) broke vi.mock isolation
    // across files, so default parallelism is kept. Occasional flakes may still
    // occur on very constrained hosts — rerunning `make check` resolves them.
    testTimeout: 30000,
    reporters: ['verbose'],
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import autoprefixer from 'autoprefixer'

// Strips Bootstrap 5 vendor-prefix declarations and deprecated Mozilla pseudo-class
// selectors that produce console warnings in modern Firefox/Chrome.
// Double-colon pseudo-elements (::-moz-range-thumb etc.) are intentionally kept.
const stripLegacyVendorCSS = root => {
  root.walkRules(rule => {
    // Remove rulesets whose selector contains a single-colon :-moz- pseudo-class.
    // Negative lookbehind excludes double-colon ::-moz- pseudo-elements.
    if (/(?<!:):-moz-/.test(rule.selector ?? '')) rule.remove()
  })
  root.walkDecls(decl => {
    if (decl.prop === '-moz-osx-font-smoothing' || decl.prop === '-webkit-text-size-adjust')
      decl.remove()
  })
}

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        autoprefixer({ overrideBrowserslist: ['last 2 Chrome versions', 'last 2 Firefox versions', 'last 2 Safari versions', 'last 2 Edge versions'] }),
        stripLegacyVendorCSS,
      ],
    },
  },
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

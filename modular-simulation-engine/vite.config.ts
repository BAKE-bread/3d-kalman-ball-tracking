// ============================================================
// vite.config.ts — Vite 8 + @vitejs/plugin-react v6
//
// Key Vite 8 changes applied here:
//   • resolve.tsconfigPaths: true  — built-in @ alias resolution,
//     replaces manual resolve.alias + path.resolve(__dirname, ...)
//     (Vite 8 replaces __dirname in config files, but tsconfigPaths
//      is the idiomatic v8 approach and avoids the import)
//   • build.target removed — Vite 8 default 'baseline-widely-available'
//     is better than 'esnext' for production; let it default
//   • optimizeDeps.esbuildOptions removed — deprecated in v8,
//     Rolldown is now the bundler
//   • server.open kept — still valid in v8
// ============================================================

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react({
      // In @vitejs/plugin-react v6, Babel is no longer a dependency.
      // Oxc handles React Refresh. No babel config needed.
    }),
  ],

  resolve: {
    // Vite 8 built-in tsconfig path resolution.
    // Reads compilerOptions.paths from tsconfig.json — no extra plugin.
    tsconfigPaths: true,
  },

  build: {
    // 'esnext' is no longer the recommended target for Vite 8.
    // 'baseline-widely-available' is the new default; omit to use it.
    sourcemap: true,
  },

  server: {
    port: 5173,
    open: true,
  },
})

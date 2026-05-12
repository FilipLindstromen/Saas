import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Default for local `vite build` (relative assets). GitHub Actions uses
// `vite build --base=/<repo>/PitchDeck/`, which overrides this.
export default defineConfig({
  base: './',
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime.js')
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime']
  },
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: false,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5174,
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    // Keep production bundle unminified to avoid rare TDZ/runtime
    // regressions we've seen in static-hosted builds.
    minify: false,
  },
})

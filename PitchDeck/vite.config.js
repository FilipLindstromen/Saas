import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
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
    // Single chunk + avoid const TDZ in Rollup wrappers; Terser instead of esbuild minify — fixes
    // "Cannot access 'X' before initialization" on some production hosts (e.g. GitHub Pages).
    modulePreload: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        passes: 2,
      },
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        generatedCode: {
          constBindings: false,
        },
      },
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Load env from repo root (localhost: one .env for all apps)
const rootEnv = path.resolve(__dirname, '..')
try {
  require('dotenv').config({ path: path.join(rootEnv, '.env') })
  require('dotenv').config({ path: path.join(rootEnv, '.env.local') })
} catch {}

// Default for local `vite build` / electron build (relative assets).
// GitHub Actions / Vercel override with `--base=/<repo>/SketchGen/`.
export default defineConfig({
  base: './',
  envDir: rootEnv,
  define: {
    'import.meta.env.VITE_OPENAI_API_KEY': JSON.stringify(process.env.OPENAI_API_KEY || ''),
  },
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
    port: 5177,
    strictPort: false,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5177,
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// This file runs as a real ES module (package.json has "type": "module"), so
// `require(...)` isn't available here — it throws "Dynamic require... is not
// supported" and silently no-ops inside a try/catch, which meant OPENAI_API_KEY
// from the root .env never actually reached the build. Use ESM imports instead.
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load env from repo root (localhost: one .env for all apps)
const rootEnv = path.resolve(__dirname, '..')
dotenv.config({ path: path.join(rootEnv, '.env') })
dotenv.config({ path: path.join(rootEnv, '.env.local') })

// Default for local `vite build` / electron build (relative assets).
// GitHub Actions / Vercel override with `--base=/<repo>/SketchGen/`.
export default defineConfig({
  base: './',
  envDir: rootEnv,
  define: {
    'import.meta.env.VITE_OPENAI_API_KEY': JSON.stringify(process.env.OPENAI_API_KEY || ''),
    'import.meta.env.VITE_APP_BUILD_ID': JSON.stringify(process.env.VITE_APP_BUILD_ID || 'dev'),
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

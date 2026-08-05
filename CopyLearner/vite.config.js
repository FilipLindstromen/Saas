import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load env from repo root (localhost: one .env for all apps)
const rootEnv = path.resolve(__dirname, '..')
dotenv.config({ path: path.join(rootEnv, '.env') })
dotenv.config({ path: path.join(rootEnv, '.env.local') })

export default defineConfig({
  base: './',
  envDir: rootEnv,
  define: {
    'import.meta.env.VITE_OPENAI_API_KEY': JSON.stringify(process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || ''),
    'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(process.env.VITE_FIREBASE_API_KEY || ''),
    'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(process.env.VITE_FIREBASE_AUTH_DOMAIN || ''),
    'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(process.env.VITE_FIREBASE_PROJECT_ID || ''),
    'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(process.env.VITE_FIREBASE_STORAGE_BUCKET || ''),
    'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''),
    'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(process.env.VITE_FIREBASE_APP_ID || ''),
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime.js'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  plugins: [react()],
  server: {
    port: 5185,
    strictPort: false,
  },
})

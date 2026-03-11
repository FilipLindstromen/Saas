import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Load env from repo root (localhost: one .env for all apps)
const rootEnv = path.resolve(__dirname, '..')
try {
  require('dotenv').config({ path: path.join(rootEnv, '.env') })
  require('dotenv').config({ path: path.join(rootEnv, '.env.local') })
} catch {}

export default defineConfig({
  envDir: rootEnv,
  define: {
    'import.meta.env.VITE_OPENAI_API_KEY': JSON.stringify(process.env.OPENAI_API_KEY || ''),
    'import.meta.env.VITE_GIPHY_API_KEY': JSON.stringify(process.env.GIPHY_API_KEY || ''),
    'import.meta.env.VITE_PEXELS_API_KEY': JSON.stringify(process.env.PEXELS_API_KEY || ''),
    'import.meta.env.VITE_UNSPLASH_ACCESS_KEY': JSON.stringify(process.env.UNSPLASH_ACCESS_KEY || ''),
    'import.meta.env.VITE_PIXABAY_API_KEY': JSON.stringify(process.env.PIXABAY_API_KEY || ''),
    'import.meta.env.VITE_ELEVENLABS_API_KEY': JSON.stringify(process.env.ELEVENLABS_API_KEY || ''),
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime.js'),
    },
  },
  plugins: [react()],
})

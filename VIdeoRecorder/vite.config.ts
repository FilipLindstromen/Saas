import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

// Helper function to copy FFmpeg files
function copyFFmpegFilesToPublic() {
  try {
    const publicDir = join(process.cwd(), 'public', 'ffmpeg')
    if (!existsSync(publicDir)) {
      mkdirSync(publicDir, { recursive: true })
    }

    const nodeModulesPath = join(process.cwd(), 'node_modules', '@ffmpeg', 'core', 'dist', 'esm')
    const coreJs = join(nodeModulesPath, 'ffmpeg-core.js')
    const coreWasm = join(nodeModulesPath, 'ffmpeg-core.wasm')
    const coreWorker = join(nodeModulesPath, 'ffmpeg-core.worker.js')

    if (existsSync(coreJs) && existsSync(coreWasm)) {
      const publicJs = join(publicDir, 'ffmpeg-core.js')
      const publicWasm = join(publicDir, 'ffmpeg-core.wasm')
      const publicWorker = join(publicDir, 'ffmpeg-core.worker.js')

      // Only copy if files don't exist or are different (to avoid unnecessary copies)
      let needsCopy = false
      if (!existsSync(publicJs) || !existsSync(publicWasm) || !existsSync(publicWorker)) {
        needsCopy = true
      }

      if (needsCopy) {
        copyFileSync(coreJs, publicJs)
        copyFileSync(coreWasm, publicWasm)
        if (existsSync(coreWorker)) {
          copyFileSync(coreWorker, publicWorker)
        }
        console.log('✓ Copied FFmpeg core files (ESM) to public/ffmpeg')
      }
    } else {
      console.warn('⚠ FFmpeg core files not found in node_modules, will use CDN fallback')
    }
  } catch (error) {
    console.warn('⚠ Failed to copy FFmpeg files:', error)
  }
}

// Plugin to copy FFmpeg core files to public directory
const copyFFmpegFiles = () => {
  // Copy files immediately when plugin loads (for dev server)
  copyFFmpegFilesToPublic()

  return {
    name: 'copy-ffmpeg-files',
    buildStart() {
      copyFFmpegFilesToPublic()
    },
    configureServer(server) {
      // Ensure files are copied when dev server starts
      copyFFmpegFilesToPublic()
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), copyFFmpegFiles()],
  base: './', // Important for Electron - use relative paths
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/core'],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})

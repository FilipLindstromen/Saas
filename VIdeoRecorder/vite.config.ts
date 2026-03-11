import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync, existsSync } from 'fs'
import path, { join } from 'path'

// Load env from repo root (localhost: one .env for all apps)
const rootEnv = path.resolve(__dirname, '..')
try {
  require('dotenv').config({ path: path.join(rootEnv, '.env') })
  require('dotenv').config({ path: path.join(rootEnv, '.env.local') })
} catch {}

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
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'
  
  return {
    envDir: rootEnv,
    define: {
      'import.meta.env.VITE_OPENAI_API_KEY': JSON.stringify(process.env.OPENAI_API_KEY || ''),
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
    plugins: [react(), copyFFmpegFiles()],
    base: './', // Important for Electron - use relative paths
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      // Production optimizations
      minify: isProduction ? 'esbuild' : false,
      sourcemap: isProduction ? false : true, // No source maps in production for security
      target: 'es2020',
      cssCodeSplit: true,
      // Optimize chunking strategy
      rollupOptions: {
        output: {
          // Manual chunking for better caching
          manualChunks: (id) => {
            // Vendor chunks
            if (id.includes('node_modules')) {
              // React and React DOM
              if (id.includes('react') || id.includes('react-dom')) {
                return 'react-vendor'
              }
              // FFmpeg (large, separate chunk)
              if (id.includes('@ffmpeg')) {
                return 'ffmpeg-vendor'
              }
              // Other large libraries
              if (id.includes('html2canvas') || id.includes('mp4box') || id.includes('mediabunny')) {
                return 'media-vendor'
              }
              // All other node_modules
              return 'vendor'
            }
          },
          // Optimize chunk file names
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name?.split('.') || []
            const ext = info[info.length - 1]
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
              return `assets/images/[name]-[hash][extname]`
            }
            if (/woff2?|eot|ttf|otf/i.test(ext)) {
              return `assets/fonts/[name]-[hash][extname]`
            }
            return `assets/[name]-[hash][extname]`
          },
        },
      },
      // Chunk size warnings
      chunkSizeWarningLimit: 1000,
      // Optimize assets
      assetsInlineLimit: 4096, // Inline assets smaller than 4kb
    },
    optimizeDeps: {
      exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/core'],
      include: ['react', 'react-dom'],
    },
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
    // Define environment variables
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __IS_PRODUCTION__: JSON.stringify(isProduction),
    },
  }
})

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.join(root, 'node_modules', '@ffmpeg', 'core', 'dist', 'umd')
const destDir = path.join(root, 'public', 'ffmpeg')

if (!fs.existsSync(srcDir)) {
  console.warn('[copy-ffmpeg-core] @ffmpeg/core not installed — skipping')
  process.exit(0)
}

fs.mkdirSync(destDir, { recursive: true })
for (const file of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
  fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file))
  console.log(`[copy-ffmpeg-core] ${file} → public/ffmpeg/`)
}

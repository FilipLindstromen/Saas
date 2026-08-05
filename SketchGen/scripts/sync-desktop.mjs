/**
 * Copies the built web app (dist/) into the same userData folder the installed
 * .exe reads from at runtime (see electron/main.cjs: getUserDataDistDir()).
 * Since vite.config.js always builds with relative asset paths, `npm run build`
 * (the same command used to deploy the web version) produces byte-identical
 * output to `npm run build:electron` — so running this after either one keeps
 * an already-installed SketchGen.exe in sync without repackaging or reinstalling.
 */
import { existsSync, mkdirSync, cpSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'

const root = join(fileURLToPath(new URL('..', import.meta.url)))
const distDir = join(root, 'dist')
const APP_FOLDER_NAME = 'SketchGen'

function getUserDataDir() {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || join(os.homedir(), 'AppData', 'Roaming')
    return join(appData, APP_FOLDER_NAME)
  }
  if (process.platform === 'darwin') {
    return join(os.homedir(), 'Library', 'Application Support', APP_FOLDER_NAME)
  }
  return join(process.env.XDG_CONFIG_HOME || join(os.homedir(), '.config'), APP_FOLDER_NAME)
}

function main() {
  if (!existsSync(join(distDir, 'index.html'))) {
    console.warn('[sync-desktop] Skipped — no dist/index.html found yet.')
    return
  }
  const target = join(getUserDataDir(), 'www')
  rmSync(target, { recursive: true, force: true })
  mkdirSync(target, { recursive: true })
  cpSync(distDir, target, { recursive: true })
  console.log(`[sync-desktop] Synced dist/ -> ${target}`)
  console.log('[sync-desktop] Restart SketchGen.exe (if open) to see the update.')
}

main()

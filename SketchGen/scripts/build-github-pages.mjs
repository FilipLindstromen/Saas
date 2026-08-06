/**
 * Production build for GitHub Pages (base path /{repo}/SketchGen/).
 * Writes build-info.json into dist/ so the live site version is easy to verify.
 */
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('..', import.meta.url)))
const repo = process.env.GITHUB_REPOSITORY_NAME || process.env.REPO_NAME || 'Saas'
const sha = process.env.GITHUB_SHA || process.env.VITE_APP_BUILD_ID || 'local'
const base = `/${repo}/SketchGen/`

process.env.VITE_APP_BUILD_ID = sha.slice(0, 7)

execSync(`node node_modules/vite/bin/vite.js build --base=${base}`, {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, VITE_APP_BUILD_ID: process.env.VITE_APP_BUILD_ID },
})

const buildInfo = {
  app: 'SketchGen',
  buildId: process.env.VITE_APP_BUILD_ID,
  base,
  builtAt: new Date().toISOString(),
}

writeFileSync(join(root, 'dist', 'build-info.json'), `${JSON.stringify(buildInfo, null, 2)}\n`, 'utf8')

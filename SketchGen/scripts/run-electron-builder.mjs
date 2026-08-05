import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('..', import.meta.url)))
const outputFile = join(root, '.electron-builder-output')
const output = existsSync(outputFile)
  ? readFileSync(outputFile, 'utf8').trim() || 'release'
  : 'release'
const extraArgs = process.argv.slice(2).join(' ')

const cmd = `npx electron-builder ${extraArgs} --config.directories.output=${output}`.trim()

console.log(`[electron-builder] output directory: ${output}`)
execSync(cmd, { stdio: 'inherit', cwd: root })

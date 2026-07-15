import { execSync } from 'node:child_process'
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('..', import.meta.url)))
const releaseDir = join(root, 'release')
const winUnpacked = join(releaseDir, 'win-unpacked')
const outputFile = join(root, '.electron-builder-output')

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function killPitchDeckProcesses() {
  if (process.platform !== 'win32') return
  const names = ['Pitch Deck 2000', 'electron']
  for (const name of names) {
    try {
      execSync(`taskkill /F /IM "${name}.exe" /T`, { stdio: 'ignore' })
    } catch {
      // No matching process — fine.
    }
  }
}

function tryRemoveWinUnpacked() {
  if (!existsSync(winUnpacked)) return true
  try {
    rmSync(winUnpacked, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
    return !existsSync(winUnpacked)
  } catch {
    return false
  }
}

async function main() {
  killPitchDeckProcesses()
  await sleep(2000)

  let output = 'release'
  if (!tryRemoveWinUnpacked()) {
    output = 'release-staging'
    console.warn(
      '[prepare-electron-build] Could not clear release/win-unpacked (files are locked).\n' +
        'Close Pitch Deck 2000 if it is running. Building to release-staging instead.'
    )
  } else {
    console.log('[prepare-electron-build] release/win-unpacked is ready.')
  }

  writeFileSync(outputFile, output, 'utf8')
}

await main()

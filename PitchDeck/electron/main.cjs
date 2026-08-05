const { app, BrowserWindow, shell, dialog, Menu, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')
const { spawn } = require('child_process')

const UI_PORT = Number(process.env.PITCHDECK_UI_PORT) || 5175
const FFMPEG_API_PORT = Number(process.env.PORT) || 3030
const DEV_URL = process.env.PITCHDECK_DEV_URL || 'http://127.0.0.1:5174'

let mainWindow = null
let uiServer = null
let ffmpegServerProc = null

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
  '.ico': 'image/x-icon',
}

function sanitizeDrawingSegment(name) {
  return String(name || 'untitled')
    .trim()
    .replace(/[^a-z0-9_-]/gi, '-')
    .replace(/-+/g, '-')
    .toLowerCase() || 'untitled'
}

function sanitizeSlideIdForFile(slideId) {
  return String(slideId || 'slide').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) || 'slide'
}

function electronDrawingFilePath(projectName, slideId) {
  const root = path.join(
    app.getPath('userData'),
    'SaasProjects',
    'pitchdeck',
    sanitizeDrawingSegment(projectName),
    'drawings'
  )
  return path.join(root, `${sanitizeSlideIdForFile(slideId)}.png`)
}

function registerDrawingIpc() {
  ipcMain.handle('drawing:save', async (_event, { projectName, slideId, buffer }) => {
    if (!buffer) return { ok: false }
    const filePath = electronDrawingFilePath(projectName, slideId)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, Buffer.from(buffer))
    return { ok: true, path: filePath }
  })

  ipcMain.handle('drawing:load', async (_event, { projectName, slideId }) => {
    const filePath = electronDrawingFilePath(projectName, slideId)
    if (!fs.existsSync(filePath)) return null
    return fs.readFileSync(filePath)
  })

  ipcMain.handle('drawing:delete', async (_event, { projectName, slideId }) => {
    const filePath = electronDrawingFilePath(projectName, slideId)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    return { ok: true }
  })
}

function isDevelopment() {
  return process.env.NODE_ENV === 'development' || !app.isPackaged
}

function getBundledDistDir() {
  return path.join(__dirname, '..', 'dist')
}

function readUiConfig() {
  try {
    const configPath = path.join(app.getPath('userData'), 'ui-config.json')
    if (!fs.existsSync(configPath)) return {}
    return JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch {
    return {}
  }
}

function resolveConfiguredUiUrl() {
  const fromEnv = process.env.PITCHDECK_UI_URL?.trim()
  if (fromEnv) return fromEnv
  const cfg = readUiConfig()
  if (typeof cfg.uiUrl === 'string' && cfg.uiUrl.trim()) return cfg.uiUrl.trim()
  return null
}

function hasIndexHtml(dir) {
  return !!(dir && fs.existsSync(path.join(dir, 'index.html')))
}

function distIndexMtime(dir) {
  try {
    return fs.statSync(path.join(dir, 'index.html')).mtimeMs
  } catch {
    return 0
  }
}

/** Walk up from exe / cwd to find PitchDeck/dist (same output as `npm run build`). */
function findProjectDistDir() {
  const seeds = [
    path.dirname(process.execPath),
    path.join(__dirname, '..'),
    process.cwd(),
  ]
  for (const seed of seeds) {
    let dir = path.resolve(seed)
    for (let depth = 0; depth < 12; depth++) {
      const indexPath = path.join(dir, 'dist', 'index.html')
      const pkgPath = path.join(dir, 'package.json')
      if (fs.existsSync(indexPath) && fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
          if (pkg.name === 'pitch-deck-generator') {
            return path.join(dir, 'dist')
          }
        } catch {
          /* ignore */
        }
      }
      const parent = path.dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  }
  return null
}

/** Prefer newest dist: env override → ui-config → beside exe → repo dist → bundled fallback. */
function resolveDistDir() {
  const explicit = process.env.PITCHDECK_DIST_DIR?.trim()
  if (explicit && hasIndexHtml(explicit)) {
    return { dir: path.resolve(explicit), source: 'PITCHDECK_DIST_DIR' }
  }

  const cfg = readUiConfig()
  if (typeof cfg.distDir === 'string' && hasIndexHtml(cfg.distDir)) {
    return { dir: path.resolve(cfg.distDir), source: 'ui-config.json distDir' }
  }

  const candidates = []
  const besideExe = path.join(path.dirname(process.execPath), 'dist')
  const projectDist = findProjectDistDir()
  const bundled = getBundledDistDir()

  if (hasIndexHtml(besideExe)) candidates.push({ dir: besideExe, source: 'dist next to .exe' })
  if (projectDist) candidates.push({ dir: projectDist, source: 'PitchDeck/dist (web build)' })
  if (hasIndexHtml(bundled)) candidates.push({ dir: bundled, source: 'bundled in app package' })

  if (candidates.length === 0) return null

  candidates.sort((a, b) => distIndexMtime(b.dir) - distIndexMtime(a.dir))
  return candidates[0]
}

function canReachUrl(urlString) {
  return new Promise((resolve) => {
    let url
    try {
      url = new URL(urlString)
    } catch {
      resolve(false)
      return
    }
    const lib = url.protocol === 'https:' ? require('https') : http
    const req = lib.get(
      urlString,
      { timeout: 8000 },
      (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400)
        res.resume()
      }
    )
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

let activeLoadUrl = null

function getServerDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'server')
  }
  return path.join(__dirname, '..', 'server')
}

function safeFilePath(rootDir, requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0])
  const relative = decoded.replace(/^\/+/, '')
  const resolved = path.normalize(path.join(rootDir, relative))
  if (!resolved.startsWith(path.normalize(rootDir))) return null
  return resolved
}

function startUiServer(rootDir) {
  return new Promise((resolve, reject) => {
    uiServer = http.createServer((req, res) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
      res.setHeader('Access-Control-Allow-Origin', '*')

      const urlPath = req.url === '/' ? '/index.html' : req.url
      const filePath = safeFilePath(rootDir, urlPath)
      if (!filePath) {
        res.writeHead(403)
        res.end('Forbidden')
        return
      }

      let targetPath = filePath
      if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
        targetPath = path.join(targetPath, 'index.html')
      }

      fs.readFile(targetPath, (err, data) => {
        if (err) {
          const fallback = path.join(rootDir, 'index.html')
          fs.readFile(fallback, (fallbackErr, fallbackData) => {
            if (fallbackErr) {
              res.writeHead(404)
              res.end('Not found')
              return
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(fallbackData)
          })
          return
        }
        const ext = path.extname(targetPath).toLowerCase()
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' })
        res.end(data)
      })
    })

    uiServer.on('error', reject)
    uiServer.listen(UI_PORT, '127.0.0.1', () => resolve(`http://127.0.0.1:${UI_PORT}`))
  })
}

function startFfmpegServer() {
  const serverDir = getServerDir()
  const serverEntry = path.join(serverDir, 'index.js')
  if (!fs.existsSync(serverEntry)) {
    console.warn('[PitchDeck] FFmpeg server not found at', serverEntry)
    return
  }

  ffmpegServerProc = spawn(
    process.execPath,
    [serverEntry],
    {
      cwd: serverDir,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        PORT: String(FFMPEG_API_PORT),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    }
  )

  ffmpegServerProc.stdout.on('data', (chunk) => {
    console.log(`[ffmpeg-server] ${chunk.toString().trim()}`)
  })
  ffmpegServerProc.stderr.on('data', (chunk) => {
    console.error(`[ffmpeg-server] ${chunk.toString().trim()}`)
  })
  ffmpegServerProc.on('exit', (code) => {
    if (code != null && code !== 0) {
      console.warn(`[PitchDeck] FFmpeg server exited with code ${code}`)
    }
    ffmpegServerProc = null
  })
}

function stopChildProcesses() {
  if (ffmpegServerProc && !ffmpegServerProc.killed) {
    ffmpegServerProc.kill()
    ffmpegServerProc = null
  }
  if (uiServer) {
    uiServer.close()
    uiServer = null
  }
}

function stripNativeMenu(win) {
  Menu.setApplicationMenu(null)
  if (!win || win.isDestroyed()) return
  win.setMenu(null)
  win.setMenuBarVisibility(false)
  if (typeof win.removeMenu === 'function') {
    win.removeMenu()
  }
}

function createWindow(loadUrl) {
  stripNativeMenu()
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    title: 'Pitch Deck 2000',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    show: false,
  })

  stripNativeMenu(mainWindow)

  mainWindow.once('ready-to-show', () => {
    stripNativeMenu(mainWindow)
    mainWindow.show()
    if (isDevelopment()) mainWindow.focus()
  })

  mainWindow.loadURL(loadUrl)
  activeLoadUrl = loadUrl

  if (isDevelopment()) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const allowed = [
      activeLoadUrl,
      loadUrl,
      DEV_URL,
      `http://127.0.0.1:${UI_PORT}`,
      `http://localhost:${UI_PORT}`,
    ].filter(Boolean)
    const allowedOrigins = new Set(
      allowed.map((entry) => {
        try {
          return new URL(entry).origin
        } catch {
          return null
        }
      }).filter(Boolean)
    )
    let targetOrigin
    try {
      targetOrigin = new URL(navigationUrl).origin
    } catch {
      event.preventDefault()
      return
    }
    if (!allowedOrigins.has(targetOrigin)) {
      event.preventDefault()
      shell.openExternal(navigationUrl)
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

async function boot() {
  stripNativeMenu()
  registerDrawingIpc()
  startFfmpegServer()

  if (isDevelopment()) {
    createWindow(DEV_URL)
    return
  }

  const remoteUrl = resolveConfiguredUiUrl()
  if (remoteUrl && (await canReachUrl(remoteUrl))) {
    console.log('[PitchDeck] Loading UI from URL:', remoteUrl)
    createWindow(remoteUrl)
    return
  }

  const resolved = resolveDistDir()
  if (!resolved) {
    dialog.showErrorBox(
      'Pitch Deck 2000',
      'No UI files found. Run "npm run build" in the PitchDeck folder, or set PITCHDECK_UI_URL / PITCHDECK_DIST_DIR.'
    )
    app.quit()
    return
  }

  console.log(`[PitchDeck] Serving UI from ${resolved.source}:\n  ${resolved.dir}`)

  const uiUrl = await startUiServer(resolved.dir)
  createWindow(uiUrl)
}

app.whenReady().then(boot)

app.on('browser-window-created', (_, window) => {
  stripNativeMenu(window)
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    boot().catch((error) => {
      console.error(error)
      dialog.showErrorBox('Pitch Deck 2000', error.message || 'Failed to start app')
    })
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  stopChildProcesses()
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  dialog.showErrorBox('Pitch Deck 2000', error.message || 'An unexpected error occurred')
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason)
})

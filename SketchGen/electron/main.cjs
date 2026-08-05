const { app, BrowserWindow, shell, dialog, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')

const UI_PORT = Number(process.env.SKETCHGEN_UI_PORT) || 5177
const DEV_URL = process.env.SKETCHGEN_DEV_URL || 'http://127.0.0.1:5177'

let mainWindow = null
let uiServer = null

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
  '.ico': 'image/x-icon',
}

function isDevelopment() {
  return process.env.NODE_ENV === 'development' || !app.isPackaged
}

function getDistDir() {
  return path.join(__dirname, '..', 'dist')
}

function safeFilePath(rootDir, requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0])
  const relative = decoded.replace(/^\/+/, '')
  const resolved = path.normalize(path.join(rootDir, relative))
  if (!resolved.startsWith(path.normalize(rootDir))) return null
  return resolved
}

function startUiServer() {
  const rootDir = getDistDir()
  return new Promise((resolve, reject) => {
    uiServer = http.createServer((req, res) => {
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
    width: 1360,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'SketchGen',
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

  if (isDevelopment()) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const allowed = [loadUrl, DEV_URL, `http://127.0.0.1:${UI_PORT}`, `http://localhost:${UI_PORT}`]
    const allowedOrigins = new Set(allowed.map((entry) => new URL(entry).origin))
    const targetOrigin = new URL(navigationUrl).origin
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

  if (isDevelopment()) {
    createWindow(DEV_URL)
    return
  }

  const distDir = getDistDir()
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    dialog.showErrorBox(
      'SketchGen',
      'App files are missing. Rebuild with: npm run electron:build:win'
    )
    app.quit()
    return
  }

  const uiUrl = await startUiServer()
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
      dialog.showErrorBox('SketchGen', error.message || 'Failed to start app')
    })
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (uiServer) {
    uiServer.close()
    uiServer = null
  }
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  dialog.showErrorBox('SketchGen', error.message || 'An unexpected error occurred')
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason)
})

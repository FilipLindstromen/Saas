const { app, BrowserWindow, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit()
}

let mainWindow

function createWindow() {
  const isDevelopment = process.env.NODE_ENV === 'development' || !app.isPackaged
  
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: !isDevelopment, // Enable web security in production
      sandbox: false, // FFmpeg requires non-sandboxed context
    },
    icon: path.join(__dirname, '../dist/icon.ico'), // Optional: add an icon
    show: false, // Don't show until ready to prevent flash
  })

  // Show window when ready to prevent flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (isDevelopment) {
      mainWindow.focus()
    }
  })

  // Load the app
  if (isDevelopment) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
    // Disable DevTools in production
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools()
    })
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault()
    // Open external URLs in default browser
    require('electron').shell.openExternal(navigationUrl)
  })
  
  // Prevent navigation to external URLs
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl)
    if (parsedUrl.origin !== 'http://localhost:5173' && !navigationUrl.startsWith('file://')) {
      event.preventDefault()
    }
  })
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  dialog.showErrorBox('Application Error', error.message || 'An unexpected error occurred')
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})


const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// Electron APIs without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // You can add custom APIs here if needed
  platform: process.platform,
})


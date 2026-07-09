const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  ffmpegApiUrl: 'http://127.0.0.1:3030',
})

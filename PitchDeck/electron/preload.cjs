const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  ffmpegApiUrl: 'http://127.0.0.1:3030',
  drawingSave: (projectName, slideId, arrayBuffer) =>
    ipcRenderer.invoke('drawing:save', { projectName, slideId, buffer: arrayBuffer }),
  drawingLoad: (projectName, slideId) =>
    ipcRenderer.invoke('drawing:load', { projectName, slideId }),
  drawingDelete: (projectName, slideId) =>
    ipcRenderer.invoke('drawing:delete', { projectName, slideId }),
})

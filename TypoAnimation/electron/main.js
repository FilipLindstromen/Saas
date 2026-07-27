// Electron main process — a thin launcher only. It does NOT ship a copy of the app: it starts
// the Next.js production server directly out of the live TypoAnimation project folder on this
// PC, so a code change just needs `npm run build` in that folder — no re-packaging this exe —
// to show up next time it's launched. That's also why packaging this (see package.json's
// "package:win" script) only tars up this small `electron/` folder rather than the whole
// project: the .next build output and node_modules are read live from PROJECT_DIR below, not
// copied into the packaged app.
const path = require('path');
const http = require('http');
const { app, BrowserWindow, dialog } = require('electron');

const PORT = 3210;

// Hardcoded to this machine's project location (this is a "just for me" launcher, not a
// redistributable installer). If the project folder ever moves, update this one line.
const PROJECT_DIR = 'C:\\Users\\Filip Lindström\\Documents\\GitProjects\\Saas\\TypoAnimation';

process.chdir(PROJECT_DIR);

let mainWindow;
let httpServer;

async function startNextServer() {
  // Resolve `next` from the live project's own node_modules explicitly — this file doesn't
  // live next to that node_modules (it's packaged separately), so a bare require('next')
  // would fail to find it via normal upward node_modules resolution.
  const next = require(path.join(PROJECT_DIR, 'node_modules', 'next'));
  const nextApp = next({ dev: false, dir: PROJECT_DIR });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  httpServer = http.createServer((req, res) => handle(req, res));
  await new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(PORT, '127.0.0.1', resolve);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    title: 'TypoAnimation',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
}

app.whenReady().then(async () => {
  try {
    await startNextServer();
    createWindow();
  } catch (err) {
    console.error('Failed to start TypoAnimation server:', err);
    dialog.showErrorBox(
      'TypoAnimation failed to start',
      `${err && err.message ? err.message : err}\n\nMake sure "npm run build" has been run in:\n${PROJECT_DIR}`
    );
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (httpServer) httpServer.close();
  if (process.platform !== 'darwin') app.quit();
});

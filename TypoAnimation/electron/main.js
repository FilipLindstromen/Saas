// Electron main process: starts the Next.js production server in-process (no child_process
// needed — Electron's main process is itself a Node.js runtime with this project's
// node_modules on its module path) and opens a native window pointed at it. Desktop-shell
// wrapper only; the app itself is unchanged — this just removes the "open a terminal, run
// npm run dev, open a browser tab" steps for local, single-user use.
const path = require('path');
const http = require('http');
const { app, BrowserWindow } = require('electron');

const PORT = 3210;
const PROJECT_DIR = path.join(__dirname, '..');

// Every API route (upload/transcribe/render/projects) resolves its data/uploads/renders
// paths off `process.cwd()`, which is correct when launched via `npm run dev`/`next start`
// (cwd is naturally the project root) but is NOT guaranteed once packaged — Windows launches
// a double-clicked .exe with cwd set to the .exe's own folder, not the app's resources
// directory where this project (and its node_modules) actually live. Fix cwd once, up front,
// before anything reads it.
process.chdir(PROJECT_DIR);

let mainWindow;
let httpServer;

async function startNextServer() {
  const next = require('next');
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

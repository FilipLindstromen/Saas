// Electron main process — a thin launcher only, mirroring TypoAnimation/electron/main.js. It
// does NOT ship a copy of the app: it spawns the live project's own `node server/index.mjs`
// (which serves the built `dist/` and the render API) straight out of the project folder on
// this PC, so a code change just needs `npm run build` in that folder — no re-packaging this
// exe — to show up next time it's launched. That's also why packaging this (see package.json's
// "package:win" script) only tars up this small `electron/` folder rather than the whole
// project: node_modules/dist are read live from PROJECT_DIR below, not copied into the app.
const path = require('path');
const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');
const { app, BrowserWindow, dialog } = require('electron');

// Works around a well-known Chromium-on-Windows bug: "Native Window Occlusion" detection can
// mark a backgrounded window as occluded and the renderer never properly resumes compositing
// on refocus, leaving the content area solid black until something forces a repaint (e.g.
// resize). Must be set before app is ready.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

// The black screen also showed up right after using the microphone (getUserMedia + an
// AudioContext driving the live waveform), which points at the GPU process itself — a known
// class of Chromium-on-Windows bug where a GPU driver hiccup (often triggered by audio-capture
// related work stealing the GPU process) leaves the compositor producing black frames instead
// of crashing outright, so nothing else here would even catch it. Falling back to software
// rendering avoids that whole bug class; this app's UI isn't GPU-heavy enough for it to matter.
app.disableHardwareAcceleration();

const PORT = 3230;

// Hardcoded to this machine's project location (this is a "just for me" launcher, not a
// redistributable installer). If the project folder ever moves, update this one line.
const PROJECT_DIR = 'C:\\Users\\Filip Lindström\\Documents\\GitProjects\\Saas\\BRollEditor';
const LOG_FILE = path.join(PROJECT_DIR, 'electron', 'renderer.log');

let mainWindow;
let serverProcess;

function logLine(line) {
  try {
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${line}\n`);
  } catch {
    // ignore — logging is best-effort
  }
}

function pingHealth(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function waitForServer(url, child, timeoutMs = 20000) {
  const start = Date.now();
  let output = '';
  const onData = (chunk) => {
    output += chunk.toString();
  };
  child.stdout?.on('data', onData);
  child.stderr?.on('data', onData);

  return new Promise((resolve, reject) => {
    let exited = false;
    child.once('exit', (code) => {
      exited = true;
      if (code !== 0) reject(new Error(`Server process exited (code ${code}):\n${output.trim() || '(no output)'}`));
    });

    const tryOnce = () => {
      if (exited) return; // the exit handler above already rejected
      http.get(url, (res) => {
        res.resume();
        resolve();
      }).on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Server did not start in time.\n${output.trim() || '(no output captured)'}`));
        } else {
          setTimeout(tryOnce, 300);
        }
      });
    };
    tryOnce();
  });
}

async function startServer() {
  const distDir = path.join(PROJECT_DIR, 'dist');
  if (!fs.existsSync(distDir)) {
    throw new Error(`No build found at:\n${distDir}\n\nRun "npm run build" in the project folder first.`);
  }

  // If a server (our own dev server, or another instance of this exe) is already answering on
  // this port, reuse it instead of spawning a duplicate — spawning a second server that can't
  // bind the port would otherwise fail immediately.
  const alreadyRunning = await pingHealth(`http://127.0.0.1:${PORT}/api/health`);
  if (alreadyRunning) return;

  // process.execPath in a PACKAGED Electron app is this .exe itself, not a plain node binary —
  // spawning it without ELECTRON_RUN_AS_NODE would relaunch the Electron app instead of running
  // the server script (and cascade into repeated failed relaunches).
  serverProcess = spawn(process.execPath, [path.join(PROJECT_DIR, 'server', 'index.mjs')], {
    cwd: PROJECT_DIR,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', BROLL_API_PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await waitForServer(`http://127.0.0.1:${PORT}/api/health`, serverProcess);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    title: 'BRollEditor',
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // Recording/transcribing runs a fetch that keeps going while the window is switched
      // away from — don't let Chromium throttle/suspend that tab's timers in the background,
      // which is a second, independent way to end up stuck on a stale black frame on refocus.
      backgroundThrottling: false,
    },
  });
  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);

  // Belt-and-suspenders for the occlusion/throttling black-screen bug: force a repaint when
  // the window becomes visible again, in case either workaround above still misses a case.
  mainWindow.on('focus', () => {
    mainWindow?.webContents.invalidate();
  });
  mainWindow.on('restore', () => {
    mainWindow?.webContents.invalidate();
  });

  // Mirror the renderer's console into a log file — the packaged app has no visible devtools,
  // so this is the only way to see a JS error (e.g. from the mic/recording code) after the fact.
  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    logLine(`console[${level}] ${message} (${sourceId}:${line})`);
  });

  // If the renderer/GPU process actually dies (crash, not just a black-frame compositor bug),
  // reload instead of leaving a permanently dead window — this is the case the black-screen
  // workarounds above can't fix themselves, since nothing repaints a process that's gone.
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    logLine(`render-process-gone: ${JSON.stringify(details)}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
    }
  });

  mainWindow.on('unresponsive', () => logLine('window unresponsive'));
  mainWindow.on('responsive', () => logLine('window responsive again'));
}

app.whenReady().then(async () => {
  try {
    await startServer();
    createWindow();
  } catch (err) {
    dialog.showErrorBox(
      'BRollEditor failed to start',
      `${err && err.message ? err.message : err}`
    );
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) serverProcess.kill();
});

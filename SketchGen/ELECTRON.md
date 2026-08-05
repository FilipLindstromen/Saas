# SketchGen — Desktop app (Windows .exe)

SketchGen can run as a local Windows desktop app via Electron, in addition to the browser.

## Development (desktop shell + hot reload)

```bash
cd SketchGen
npm install
npm run electron:dev
```

This starts the Vite dev server on port `5177` and opens the Electron window pointed at it.

## Build Windows installer / portable exe

```bash
cd SketchGen
npm install
npm run electron:build:win
```

Output is written to `SketchGen/release/`:

- **NSIS installer** — `SketchGen Setup x.x.x.exe`
- **Portable exe** — `SketchGen x.x.x.exe` (no install required)

To unpack without creating an installer:

```bash
npm run electron:pack
```

## How it works

- **Electron shell** (`electron/main.cjs`) opens the app in a native window.
- In production it serves the app from a tiny local HTTP server, then loads it.
- Image generation calls OpenAI directly from the renderer (same as the browser build) — no bundled backend server is needed.
- Your OpenAI key is read from the shared Settings screen (localStorage) or from the root `.env` at build time, same as the other SaaS apps.

## Staying in sync with the web version (no repackaging)

The installed exe does **not** read its files from inside the installer. Instead it reads from
`%APPDATA%\SketchGen\www`, and `npm run build` — the exact command used to build the web
version — automatically copies the fresh `dist/` there via `scripts/sync-desktop.mjs`. Since
`vite.config.js` always builds with relative asset paths, the web build and the electron build
are byte-identical, so this is safe.

Practically: after you change SketchGen's code, just run

```bash
npm run build
```

then restart SketchGen.exe (if it was open) — no reinstalling, no re-running `electron:build:win`.
You only need to repackage the installer again if you change `electron/main.cjs`/`preload.cjs`
themselves (the shell code), or want a fresh installer to hand to someone else.

On first launch (or if `%APPDATA%\SketchGen\www` is ever deleted), the app falls back to seeding
itself from the snapshot bundled inside the installer, so it never fails to start.

## Web vs desktop

| | Browser | Desktop (.exe) |
|---|---|---|
| Run | `npm run dev` | `npm run electron:dev` |
| Build | `npm run build` | `npm run build` (auto-syncs an already-installed exe) or `npm run electron:build:win` (fresh installer) |

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
- In production it serves the built `dist/` folder from a tiny local HTTP server, then loads it.
- Image generation calls OpenAI directly from the renderer (same as the browser build) — no bundled backend server is needed.
- Your OpenAI key is read from the shared Settings screen (localStorage) or from the root `.env` at build time, same as the other SaaS apps.

## Web vs desktop

| | Browser | Desktop (.exe) |
|---|---|---|
| Run | `npm run dev` | `npm run electron:dev` |
| Build | `npm run build` | `npm run electron:build:win` |

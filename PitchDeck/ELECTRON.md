# Pitch Deck 2000 — Desktop app (Windows .exe)

PitchDeck can run as a local Windows desktop app via Electron.

## Prerequisites

- **Node.js** 18+
- **FFmpeg** on your system (for fast video export and transcription):
  - Windows: `winget install FFmpeg`
  - macOS: `brew install ffmpeg`

Without FFmpeg, the app still runs but falls back to slower in-browser processing for some video features.

## Development (desktop shell + hot reload)

```bash
cd PitchDeck
npm install
npm run server:install
npm run electron:dev
```

This starts the Vite dev server and opens the Electron window. The bundled FFmpeg API server starts automatically on port `3030`.

## Build Windows installer / portable exe

```bash
cd PitchDeck
npm install
npm run electron:build:win
```

Output is written to `PitchDeck/release/`:

- **NSIS installer** — `Pitch Deck 2000 Setup x.x.x.exe`
- **Portable exe** — `Pitch Deck 2000 x.x.x.exe` (no install required)

To unpack without creating an installer:

```bash
npm run electron:pack
```

## How it works

- **Electron shell** (`electron/main.cjs`) opens the app in a native window.
- **Production UI** is served locally from `dist/` with the headers required for FFmpeg.wasm.
- **FFmpeg API server** (`server/`) is bundled and started automatically for export/transcription.
- **FFmpeg.wasm** is bundled in `public/ffmpeg/` for offline browser fallback (no CDN required).
- Projects are stored locally (browser storage + optional project folder via File System Access API).

## Web vs desktop

| | Browser | Desktop (.exe) |
|---|---|---|
| Run | `npm run dev` | `npm run electron:dev` |
| Build | `npm run build` | `npm run electron:build:win` |
| FFmpeg server | Manual `npm run server` | Starts automatically |

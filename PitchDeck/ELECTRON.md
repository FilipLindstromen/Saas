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
- **Production UI** uses the **same `dist/` folder as the web app** (`npm run build`). On startup the shell picks the newest available copy:
  1. `PITCHDECK_DIST_DIR` (optional override)
  2. `distDir` in `%APPDATA%/…/ui-config.json`
  3. `dist/` next to the `.exe`
  4. **`PitchDeck/dist`** in the project (found by walking up from the exe — e.g. `release/*.exe` → parent `PitchDeck/dist`)
  5. Bundled copy inside the installer (fallback if you run the exe without a local build)
- After you change the web app, run **`npm run build`** in `PitchDeck` and **restart the desktop app** — no need to rebuild the `.exe` unless Electron or the FFmpeg server changed.
- **Optional hosted UI:** set `PITCHDECK_UI_URL` to your deployed web URL (must send COOP/COEP headers like Vite preview), or put `{ "uiUrl": "https://…" }` in `ui-config.json` under the app userData folder. The shell loads that URL when reachable so the exe tracks your live web deploy.
- **FFmpeg API server** (`server/`) is bundled and started automatically for export/transcription.
- **FFmpeg.wasm** is bundled in `public/ffmpeg/` for offline browser fallback (no CDN required).
- Projects are stored locally (browser storage + optional project folder via File System Access API).

### ui-config.json (optional)

Location: `%APPDATA%/Pitch Deck 2000/ui-config.json` (Windows)

```json
{
  "uiUrl": "https://your-host.example/path/to/pitchdeck/",
  "distDir": "C:\\\\path\\\\to\\\\Saas\\\\PitchDeck\\\\dist"
}
```

## Web vs desktop

| | Browser | Desktop (.exe) |
|---|---|---|
| Run | `npm run dev` | `npm run electron:dev` |
| Update UI | `npm run build` (or deploy web) | Same — `npm run build`, then restart exe |
| Rebuild shell | — | `npm run electron:build:win` (only when Electron/server packaging changes) |
| FFmpeg server | Manual `npm run server` | Starts automatically |

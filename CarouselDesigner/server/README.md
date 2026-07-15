# FFmpeg API server

Runs FFmpeg **on the server** for faster audio extraction (transcription) and video export. The frontend uses this when `VITE_FFMPEG_API_URL` is set.

## Requirements

- **Node.js** 18+
- **FFmpeg** installed on the system:
  - Windows: `winget install FFmpeg` or [ffmpeg.org](https://ffmpeg.org/download.html)
  - macOS: `brew install ffmpeg`
  - Linux: `apt install ffmpeg` / `dnf install ffmpeg`

## Setup and run

```bash
cd server
npm install
npm start
```

Server runs at **http://localhost:3030** (or set `PORT`).

## Frontend configuration

Create a `.env` in the project root (or copy from `.env.example`):

```
VITE_FFMPEG_API_URL=http://localhost:3030
```

Restart the Vite dev server. The app will use the server for:

- **Extract audio** (when video &gt; 25 MB for Whisper)
- **Export video** (trimmed segments + optional captions)

If `VITE_FFMPEG_API_URL` is not set, the app falls back to FFmpeg.wasm in the browser.

## Endpoints

- `POST /api/extract-audio` — form field `video` (file). Returns audio (MP3/M4A/WebM) under 25 MB.
- `POST /api/export-video` — form fields: `video` (file), `segments` (JSON array of `{ start, end }`), optional `captions` (JSON: `{ segments: [{ start, end, text }], style }`). Returns trimmed (and optionally captioned) video.

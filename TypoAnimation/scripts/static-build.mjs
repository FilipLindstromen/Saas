#!/usr/bin/env node
// Builds a static-export "preview only" version of TypoAnimation for GitHub Pages: script ->
// scenes -> live animated preview, no server. Upload/transcribe/render/b-roll all need a real
// backend (ffmpeg, whisper.cpp, headless-Chromium rendering, external API keys) that a static
// export fundamentally can't provide, so those routes are excluded from this build entirely —
// Next's `output: "export"` errors on any Route Handler that isn't itself statically
// generateable, which none of ours are. Temporarily move src/app/api/ out of the way, build,
// put it back (even on failure) so the regular `npm run dev`/`npm run build` are unaffected.

import { existsSync, renameSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const apiDir = path.join(ROOT, 'src', 'app', 'api');
const apiBackup = path.join(ROOT, 'src', 'app', '_api_disabled_for_static_build');

let moved = false;
try {
  if (existsSync(apiDir)) {
    renameSync(apiDir, apiBackup);
    moved = true;
  }
  execSync('npx next build', {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, STATIC_EXPORT: 'true' },
  });
} finally {
  if (moved) renameSync(apiBackup, apiDir);
}

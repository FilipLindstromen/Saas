import os from 'os';
import path from 'path';
import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import { installWhisperCpp, downloadWhisperModel, transcribe as whisperTranscribe, toCaptions } from '@remotion/install-whisper-cpp';
import type { Caption } from '@remotion/captions';

// Pinned to the release Remotion ships a prebuilt Windows binary for (their own S3-hosted
// zip) rather than a newer version, since @remotion/install-whisper-cpp otherwise falls back
// to a GitHub release asset that isn't guaranteed to exist for every version on Windows.
const WHISPER_VERSION = '1.5.5';
const WHISPER_WINDOWS_ZIP_URL = 'https://remotion-ffmpeg-binaries.s3.eu-central-1.amazonaws.com/whisper-bin-x64-1-5-5.zip';
const MODEL = 'base.en' as const;

const WHISPER_DIR = path.join(process.cwd(), 'data', 'whisper');
const WHISPER_BIN_DIR = path.join(WHISPER_DIR, 'whisper.cpp');
const WHISPER_MODEL_DIR = path.join(WHISPER_DIR, 'models');

function run(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${bin} exited with code ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

export async function ffprobeDurationMs(filePath: string): Promise<number> {
  try {
    const out = await run('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    const sec = parseFloat(out.trim());
    return Number.isFinite(sec) ? Math.round(sec * 1000) : 0;
  } catch {
    return 0;
  }
}

async function extractWav(videoPath: string, wavPath: string): Promise<void> {
  await run('ffmpeg', ['-y', '-i', videoPath, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wavPath]);
}

// PowerShell single-quoted string literal: only the embedded-quote case needs escaping
// (by doubling); backslashes are literal, unlike in a double-quoted string.
function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function expandArchiveWindows(zipPath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = `Expand-Archive -Force -LiteralPath ${psQuote(zipPath)} -DestinationPath ${psQuote(destDir)}`;
    // IMPORTANT: pass the whole script as a SINGLE argv element to -Command, with paths
    // PowerShell-quoted ourselves. Two other approaches both break on a path containing a
    // space (e.g. "C:\Users\Jane Doe\...", which is any Windows profile with a space in the
    // name): (1) `spawn(bin, args, {shell: 'powershell'})` — what
    // @remotion/install-whisper-cpp's own Windows installer does — makes Node re-join and
    // re-escape the argv using POSIX-style rules before handing it to the shell, which eats
    // every backslash in the path; (2) passing `-Command` followed by several separate argv
    // elements — PowerShell.exe reconstructs its script by simply space-joining its own
    // argv, so a single logical argument that contained a space (e.g. the path) becomes
    // indistinguishable from two separate tokens once re-joined, and Expand-Archive sees a
    // stray extra positional argument.
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Expand-Archive exited with code ${code}`))
    );
  });
}

async function downloadToFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(destPath, buffer);
}

// Re-implements @remotion/install-whisper-cpp's Windows install step (see expandArchiveWindows
// for why) rather than calling its installWhisperCpp() on win32. Layout matches what
// getWhisperExecutablePath() expects for version 1.5.5 (main.exe directly in `to`), so once
// this has run once, future calls just see the executable already there and no-op.
async function installWhisperCppWindows(to: string): Promise<void> {
  if (existsSync(path.join(to, 'main.exe'))) return;
  await fs.mkdir(WHISPER_DIR, { recursive: true });
  const zipPath = path.join(WHISPER_DIR, 'whisper-bin-x64.zip');
  await downloadToFile(WHISPER_WINDOWS_ZIP_URL, zipPath);
  await expandArchiveWindows(zipPath, to);
  await fs.unlink(zipPath).catch(() => {});
}

async function ensureWhisperReady(onProgress?: (msg: string) => void): Promise<void> {
  await fs.mkdir(WHISPER_DIR, { recursive: true });
  onProgress?.('Installing whisper.cpp (one-time, downloads a small binary)…');
  if (os.platform() === 'win32') {
    await installWhisperCppWindows(WHISPER_BIN_DIR);
  } else {
    await installWhisperCpp({ version: WHISPER_VERSION, to: WHISPER_BIN_DIR, printOutput: false });
  }
  onProgress?.('Downloading speech-to-text model (one-time, ~150MB)…');
  // downloadWhisperModel() opens its write stream without first creating the destination
  // folder; on a missing directory the stream's own 'error' event goes unlistened-for while
  // the download loop still reads the response to completion and resolves normally — so it
  // silently "succeeds" without ever having written the model file. Pre-create the folder to
  // avoid that path entirely.
  await fs.mkdir(WHISPER_MODEL_DIR, { recursive: true });
  await downloadWhisperModel({ model: MODEL, folder: WHISPER_MODEL_DIR, printOutput: false });
}

// Full local pipeline: extract mono 16kHz audio via ffmpeg, run it through a locally
// installed whisper.cpp (no API key, no network calls beyond the one-time binary/model
// download), and convert the word-level tokens into Caption[] (startMs/endMs per word).
export async function transcribeVideo(videoPath: string, onProgress?: (msg: string) => void): Promise<Caption[]> {
  await ensureWhisperReady(onProgress);

  const wavPath = path.join(path.dirname(videoPath), `${path.basename(videoPath, path.extname(videoPath))}.wav`);
  onProgress?.('Extracting audio…');
  await extractWav(videoPath, wavPath);

  onProgress?.('Transcribing (this can take a while on the first run)…');
  const json = await whisperTranscribe({
    inputPath: wavPath,
    whisperPath: WHISPER_BIN_DIR,
    whisperCppVersion: WHISPER_VERSION,
    model: MODEL,
    modelFolder: WHISPER_MODEL_DIR,
    tokenLevelTimestamps: true,
    printOutput: false,
  });

  const { captions } = toCaptions({ whisperCppOutput: json });
  return captions;
}

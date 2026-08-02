import os from 'os';
import path from 'path';
import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import { installWhisperCpp, downloadWhisperModel, transcribe as whisperTranscribe, toCaptions } from '@remotion/install-whisper-cpp';
import type { Caption } from '@remotion/captions';
import { normalizeCaptionWords } from './segmentCaptions';

// Pinned to the release Remotion ships a prebuilt Windows binary for (their own S3-hosted
// zip) rather than a newer version, since @remotion/install-whisper-cpp otherwise falls back
// to a GitHub release asset that isn't guaranteed to exist for every version on Windows.
const WHISPER_VERSION = '1.5.5';
const WHISPER_WINDOWS_ZIP_URL = 'https://remotion-ffmpeg-binaries.s3.eu-central-1.amazonaws.com/whisper-bin-x64-1-5-5.zip';
const MODEL = 'base.en' as const;

const WHISPER_DIR = path.join(process.cwd(), 'data', 'whisper');
const WHISPER_BIN_DIR = path.join(WHISPER_DIR, 'whisper.cpp');
const WHISPER_MODEL_DIR = path.join(WHISPER_DIR, 'models');
const WHISPER_MODEL_FILE = path.join(WHISPER_MODEL_DIR, `ggml-${MODEL}.bin`);

/** Overall job progress streamed to the UI during transcribe. */
export type TranscribeProgressEvent = {
  phase: 'install_whisper' | 'download_model' | 'extract_audio' | 'transcribe' | 'done';
  message: string;
  /** 0–100 */
  progress: number;
};

const PROGRESS = {
  install: [0, 8] as const,
  model: [8, 42] as const,
  extract: [42, 48] as const,
  transcribe: [48, 99] as const,
};

function segmentProgress(range: readonly [number, number], t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return Math.round(range[0] + (range[1] - range[0]) * clamped);
}

function report(onProgress: ((e: TranscribeProgressEvent) => void) | undefined, event: TranscribeProgressEvent) {
  onProgress?.(event);
}

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

async function ensureWhisperReady(onProgress?: (e: TranscribeProgressEvent) => void): Promise<void> {
  await fs.mkdir(WHISPER_DIR, { recursive: true });

  const whisperExe =
    os.platform() === 'win32' ? path.join(WHISPER_BIN_DIR, 'main.exe') : path.join(WHISPER_BIN_DIR, 'main');
  const needsWhisper = !existsSync(whisperExe);

  if (needsWhisper) {
    report(onProgress, {
      phase: 'install_whisper',
      message: 'Installing whisper.cpp (one-time download)…',
      progress: PROGRESS.install[0],
    });
  }

  if (os.platform() === 'win32') {
    await installWhisperCppWindows(WHISPER_BIN_DIR);
  } else {
    await installWhisperCpp({ version: WHISPER_VERSION, to: WHISPER_BIN_DIR, printOutput: false });
  }

  if (needsWhisper) {
    report(onProgress, {
      phase: 'install_whisper',
      message: 'whisper.cpp ready',
      progress: PROGRESS.install[1],
    });
  }

  const needsModel = !existsSync(WHISPER_MODEL_FILE);
  if (needsModel) {
    report(onProgress, {
      phase: 'download_model',
      message: 'Downloading speech model (one-time, ~148 MB)…',
      progress: PROGRESS.model[0],
    });
  }

  await fs.mkdir(WHISPER_MODEL_DIR, { recursive: true });
  await downloadWhisperModel({
    model: MODEL,
    folder: WHISPER_MODEL_DIR,
    printOutput: false,
    onProgress: needsModel
      ? (downloaded, total) => {
          const pct = total > 0 ? downloaded / total : 0;
          const mbDone = (downloaded / (1024 * 1024)).toFixed(0);
          const mbTotal = (total / (1024 * 1024)).toFixed(0);
          report(onProgress, {
            phase: 'download_model',
            message: `Downloading speech model… ${Math.round(pct * 100)}% (${mbDone} / ${mbTotal} MB)`,
            progress: segmentProgress(PROGRESS.model, pct),
          });
        }
      : undefined,
  });

  if (needsModel) {
    report(onProgress, {
      phase: 'download_model',
      message: 'Speech model ready',
      progress: PROGRESS.model[1],
    });
  }
}

// Full local pipeline: extract mono 16kHz audio via ffmpeg, run it through a locally
// installed whisper.cpp (no API key, no network calls beyond the one-time binary/model
// download), and convert the word-level tokens into Caption[] (startMs/endMs per word).
export async function transcribeVideo(
  videoPath: string,
  onProgress?: (e: TranscribeProgressEvent) => void
): Promise<Caption[]> {
  await ensureWhisperReady(onProgress);

  const wavPath = path.join(path.dirname(videoPath), `${path.basename(videoPath, path.extname(videoPath))}.wav`);
  report(onProgress, {
    phase: 'extract_audio',
    message: 'Extracting audio from video…',
    progress: PROGRESS.extract[0],
  });
  await extractWav(videoPath, wavPath);
  report(onProgress, {
    phase: 'extract_audio',
    message: 'Audio extracted',
    progress: PROGRESS.extract[1],
  });

  report(onProgress, {
    phase: 'transcribe',
    message: 'Transcribing speech (local whisper.cpp)…',
    progress: PROGRESS.transcribe[0],
  });

  const json = await whisperTranscribe({
    inputPath: wavPath,
    whisperPath: WHISPER_BIN_DIR,
    whisperCppVersion: WHISPER_VERSION,
    model: MODEL,
    modelFolder: WHISPER_MODEL_DIR,
    tokenLevelTimestamps: true,
    printOutput: false,
    onProgress: (t) => {
      report(onProgress, {
        phase: 'transcribe',
        message: `Transcribing… ${Math.round(t * 100)}%`,
        progress: segmentProgress(PROGRESS.transcribe, t),
      });
    },
  });

  const { captions } = toCaptions({ whisperCppOutput: json });
  const normalized = normalizeCaptionWords(
    captions.map((c) => ({ text: c.text, startMs: c.startMs, endMs: c.endMs }))
  );
  report(onProgress, {
    phase: 'done',
    message: `Done — ${normalized.length} words transcribed`,
    progress: 100,
  });
  return normalized as Caption[];
}

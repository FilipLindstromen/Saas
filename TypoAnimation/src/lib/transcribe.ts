import path from 'path';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import { installWhisperCpp, downloadWhisperModel, transcribe as whisperTranscribe, toCaptions } from '@remotion/install-whisper-cpp';
import type { Caption } from '@remotion/captions';

// Pinned to the release Remotion ships a prebuilt Windows binary for (their own S3-hosted
// zip) rather than a newer version, since @remotion/install-whisper-cpp otherwise falls back
// to a GitHub release asset that isn't guaranteed to exist for every version on Windows.
const WHISPER_VERSION = '1.5.5';
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

async function ensureWhisperReady(onProgress?: (msg: string) => void): Promise<void> {
  await fs.mkdir(WHISPER_DIR, { recursive: true });
  onProgress?.('Installing whisper.cpp (one-time, downloads a small binary)…');
  await installWhisperCpp({ version: WHISPER_VERSION, to: WHISPER_BIN_DIR, printOutput: false });
  onProgress?.('Downloading speech-to-text model (one-time, ~150MB)…');
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

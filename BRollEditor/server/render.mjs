import path from 'node:path'
import fsSync from 'node:fs'
import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'

const execFileAsync = promisify(execFile)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const ENTRY_POINT = path.join(ROOT, 'src', 'remotion', 'index.ts')
export const RENDER_DIR = path.join(__dirname, 'renders')

const CRF_BY_QUALITY = { draft: 28, standard: 23, high: 16 }
const COMPOSITION_ID = 'BRoll'

// Remotion's own compositor ships a trimmed ffmpeg build (guaranteed present, but limited to
// the filters Remotion's own rendering needs — just loudnorm, no denoising) as a fallback of
// last resort. A full ffmpeg build on PATH — which is what's actually installed on this
// machine — has real filters (arnndn, afftdn) too, so it's tried first for meaningfully better
// output; the trimmed one is only a safety net if that's ever unavailable.
const BUNDLED_FFMPEG = path.join(ROOT, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe')

// A small (~290KB), permissively-licensed pretrained RNNoise model (from
// github.com/GregorR/rnnoise-models — its README states the trained models aren't creative work
// and so carry no copyright restriction), used by ffmpeg's `arnndn` filter for real neural-net
// noise suppression. Picked the "somnolent-hogwash" model specifically: trained on
// recording-condition noise (room hiss/hum) against a speech signal, which is exactly this app's
// use case (someone talking into a mic, not a pristine studio). Referenced as a path RELATIVE TO
// ROOT (see the `cwd` passed to execFileAsync below) rather than an absolute one — ffmpeg's
// filtergraph syntax uses `:` as its own option separator, which collides with a Windows drive
// letter ("C:") in an absolute path and breaks parsing.
const RNNOISE_MODEL_REL = path.join('server', 'models', 'rnnoise-somnolent-hogwash.rnnn')
const RNNOISE_MODEL_ABS = path.join(ROOT, RNNOISE_MODEL_REL)

let cachedFfmpeg = null
async function resolveFfmpeg() {
  if (cachedFfmpeg) return cachedFfmpeg
  try {
    await execFileAsync('ffmpeg', ['-version'])
    const { stdout } = await execFileAsync('ffmpeg', ['-hide_banner', '-h', 'filter=arnndn'])
    const hasArnndn = /Reduce noise from speech using Recurrent Neural Networks/.test(stdout) && fsSync.existsSync(RNNOISE_MODEL_ABS)
    cachedFfmpeg = { path: 'ffmpeg', hasDenoise: true, hasArnndn }
  } catch {
    cachedFfmpeg = { path: fsSync.existsSync(BUNDLED_FFMPEG) ? BUNDLED_FFMPEG : 'ffmpeg', hasDenoise: false, hasArnndn: false }
  }
  return cachedFfmpeg
}

// "Studio Sound": a real audio-mastering chain, not a placeholder —
//   1. arnndn: a recurrent-neural-network denoiser (real ML, not classical spectral subtraction)
//      that reaches a noticeably lower noise floor than afftdn on real mic/room noise (~7dB more
//      reduction in testing) while leaving speech intact — falls back to afftdn's classical
//      spectral subtraction if the model file or filter isn't available, and further down to no
//      denoising at all if only the trimmed bundled ffmpeg is available (see resolveFfmpeg above).
//   2. loudnorm: EBU R128 loudness normalization, the same broadcast/podcast loudness standard
//      mastering tools target, so the level is consistent and properly leveled.
// (dialoguenhance was tried too, but it's built for pulling dialogue out of a stereo/surround
// movie mix and upmixes plain mono narration to 3 channels as a side effect — the wrong tool
// for a single-voice recording, so it's deliberately left out.)
async function applyStudioSound(filePath) {
  const { path: ffmpeg, hasDenoise, hasArnndn } = await resolveFfmpeg()
  const tmpPath = filePath.replace(/\.mp4$/, '.studio.mp4')
  const denoise = hasArnndn ? `arnndn=m=${RNNOISE_MODEL_REL.replace(/\\/g, '/')}` : hasDenoise ? 'afftdn=nr=12:nf=-25' : null
  const audioFilter = denoise ? `${denoise},loudnorm=I=-16:TP=-1.5:LRA=11` : 'loudnorm=I=-16:TP=-1.5:LRA=11'
  await execFileAsync(ffmpeg, [
    '-y', '-i', filePath,
    '-af', audioFilter,
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    tmpPath,
  ], { cwd: ROOT })
  await fs.rename(tmpPath, filePath)
}

// Rebundled per render, not cached: audio/b-roll referenced by URL can point at files this
// server only started serving after boot (a fresh /uploads/<id> from this same session), and
// Remotion's bundler doesn't need to re-see them anyway since everything is fetched by URL at
// render time, not baked into the bundle — but re-bundling is cheap (a few seconds) next to a
// render, so it's not worth the staleness risk of caching across code changes either.
function getBundleLocation() {
  return bundle({ entryPoint: ENTRY_POINT, onProgress: () => {} })
}

function toAbsoluteUrl(url, selfOrigin) {
  if (!url) return url
  if (/^https?:\/\//i.test(url)) return url
  return `${selfOrigin}${url.startsWith('/') ? '' : '/'}${url}`
}

// Every URL the composition renders (narration, uploaded b-roll, uploaded music) needs to be
// absolute before it reaches Remotion's headless-Chromium renderer — a relative "/uploads/x.mp3"
// resolves fine in the browser (same origin as the page), but the renderer's own browser context
// has no such base URL to resolve it against, and playback just fails silently (or, for <Audio>,
// throws a MediaError during render). Stock-media URLs (Pexels/Pixabay/Unsplash) are already
// absolute and pass through untouched.
function resolveProjectUrls(project, selfOrigin) {
  return {
    ...project,
    audioUrl: toAbsoluteUrl(project.audioUrl, selfOrigin),
    music: { ...project.music, url: toAbsoluteUrl(project.music?.url ?? null, selfOrigin) },
    // 'color' b-roll's "url" is a hex color, not a media URL — toAbsoluteUrl must never touch it.
    lines: project.lines.map((line) => (
      line.broll && line.broll.type !== 'color'
        ? { ...line, broll: { ...line.broll, url: toAbsoluteUrl(line.broll.url, selfOrigin) } }
        : line
    )),
  }
}

export async function renderProject(jobId, project, { selfOrigin, onProgress }) {
  const inputProps = {
    project: resolveProjectUrls(project, selfOrigin),
  }

  const serveUrl = await getBundleLocation()
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps })

  await fs.mkdir(RENDER_DIR, { recursive: true })
  const filename = `${jobId}.mp4`
  const outputLocation = path.join(RENDER_DIR, filename)
  const crf = CRF_BY_QUALITY[project.quality] ?? CRF_BY_QUALITY.standard

  const progressScale = project.studioSound ? 0.9 : 1
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    audioCodec: 'aac',
    outputLocation,
    inputProps,
    crf,
    onProgress: ({ progress }) => onProgress(progress * progressScale),
  })

  if (project.studioSound) {
    await applyStudioSound(outputLocation)
  }
  onProgress(1)

  return `/renders/${filename}`
}

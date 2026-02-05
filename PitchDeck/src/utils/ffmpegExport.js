/**
 * FFmpeg: client (WASM) or server. Set VITE_FFMPEG_API_URL to use server-side FFmpeg for faster results.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg'

export function getFfmpegApiBase() {
  const url = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_FFMPEG_API_URL
  return (url && String(url).trim()) || ''
}

async function serverExtractAudio(baseUrl, blob, opts = {}) {
  const report = (msg) => opts.onProgress?.(msg)
  report?.('Uploading…')
  const form = new FormData()
  form.append('video', blob, blob.name || 'video.webm')
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/extract-audio`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || res.statusText || 'Server failed')
  }
  report?.('Done')
  return res.blob()
}

async function serverExportVideo(baseUrl, blob, segments, opts = {}) {
  const report = (msg) => opts.onProgress?.(msg)
  report?.('Uploading…')
  const form = new FormData()
  form.append('video', blob, blob.name || 'video.webm')
  form.append('segments', JSON.stringify(segments))
  form.append('format', opts.format || 'mp4')
  form.append('quality', opts.quality || 'high')
  form.append('resolution', opts.resolution || 'original')
  if (opts.captions && (opts.captions.segments?.length > 0 || (opts.captions.transcript && opts.captions.duration))) {
    form.append('captions', JSON.stringify(opts.captions))
  }
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/export-video`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || res.statusText || 'Server failed')
  }
  report?.('Done')
  return res.blob()
}

let ffmpegInstance = null
let loadPromise = null

async function getFFmpeg() {
  if (ffmpegInstance?.loaded) return ffmpegInstance
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    const ffmpeg = new FFmpeg()
    await ffmpeg.load({
      coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js',
      wasmURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm',
    })
    ffmpegInstance = ffmpeg
    return ffmpeg
  })()
  return loadPromise
}

/** Preload client FFmpeg only when server is not configured (avoids loading WASM when using server). */
export function preloadFFmpeg() {
  if (!getFfmpegApiBase()) getFFmpeg().catch(() => {})
}

function inputExtFromType(type) {
  if (!type) return 'webm'
  const t = type.toLowerCase()
  if (t.includes('mp4')) return 'mp4'
  if (t.includes('ogg')) return 'ogg'
  return 'webm'
}

/**
 * Convert a video blob (e.g. WebM, OGG) to high-quality MP4 for reliable playback.
 * @param {Blob} blob - Input video blob (WebM, OGG, etc.)
 * @param {object} opts - { onProgress?: (p) => void }
 * @returns {Promise<Blob>} MP4 blob
 */
export async function convertToMp4(blob, opts = {}) {
  const ffmpeg = await getFFmpeg()
  const ext = inputExtFromType(blob?.type)
  const inputName = `input.${ext}`
  const outputName = 'output.mp4'

  const data = new Uint8Array(await blob.arrayBuffer())
  await ffmpeg.writeFile(inputName, data)

  // High quality: H.264 CRF 18, medium preset, AAC 192k
  const args = [
    '-i', inputName,
    '-c:v', 'libx264',
    '-crf', '18',
    '-preset', 'medium',
    '-movflags', '+faststart',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-y',
    outputName
  ]

  if (opts.onProgress) {
    const cb = (e) => opts.onProgress(e?.progress ?? 0)
    ffmpeg.on('progress', cb)
    try {
      await ffmpeg.exec(args)
    } finally {
      ffmpeg.off('progress', cb)
    }
  } else {
    await ffmpeg.exec(args)
  }

  const outData = await ffmpeg.readFile(outputName)
  const outBlob = outData instanceof Uint8Array
    ? new Blob([outData], { type: 'video/mp4' })
    : new Blob([outData.buffer], { type: 'video/mp4' })

  // Cleanup virtual files
  try {
    await ffmpeg.deleteFile(inputName)
    await ffmpeg.deleteFile(outputName)
  } catch (_) {}

  return outBlob
}

const toAssTime = (sec) => {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(Math.floor(s)).padStart(2, '0')}.${String(Math.round((s % 1) * 100)).padStart(2, '0')}`
}

function getAssStyleAndHeader(style) {
  const alignmentNum = style === 'top-black' ? 8 : 2
  let primaryColour = '&H00FFFFFF'
  let backColour = '&H80000000'
  let outlineColour = '&H00000000'
  let borderStyle = '1'
  let outline = '2'
  let shadow = '1'
  if (style === 'bottom-white') {
    primaryColour = '&H00000000'
    backColour = '&H80FFFFFF'
  } else if (style === 'white-outline') {
    backColour = '&H00000000'
    outlineColour = '&H00000000'
  }
  const marginV = 30
  const styleLine = `Style: Default,Arial,28,${primaryColour},&H000000FF,${outlineColour},${backColour},-1,0,0,0,100,100,0,0,${borderStyle},${outline},${shadow},${alignmentNum},10,10,${marginV},1`
  return `[Script Info]
Title: Burned captions
ScriptType: v4.00+
PlayResX: 384
PlayResY: 288
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${styleLine}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`
}

/**
 * Build ASS from segments (Descript-style: one line per segment with correct output timeline).
 * @param {Array<{ start: number, end: number, text: string }>} segments - In export order; output times are cumulative.
 * @param {'bottom-black'|'bottom-white'|'top-black'|'white-outline'} style
 * @returns {string} ASS file content
 */
function buildAssFromSegments(segments, style) {
  if (!Array.isArray(segments) || segments.length === 0) return ''
  const header = getAssStyleAndHeader(style || 'bottom-black')
  let outTime = 0
  const lines = segments.map((seg) => {
    const duration = Math.max(0.01, (seg.end || 0) - (seg.start || 0))
    const start = outTime
    const end = outTime + duration
    outTime = end
    const text = (seg.text || '').replace(/\r/g, '').replace(/\n/g, '\\N').trim()
    if (!text) return null
    return `Dialogue: 0,${toAssTime(start)},${toAssTime(end)},Default,,0,0,0,,${text}`
  }).filter(Boolean)
  return lines.length ? header + lines.join('\n') : ''
}

/**
 * Build ASS subtitle content from transcript text, spread evenly over duration.
 * @param {string} transcript - Plain text transcript
 * @param {number} durationSeconds - Total video duration in seconds
 * @param {'bottom-black'|'bottom-white'|'top-black'|'white-outline'} style - Caption style
 * @returns {string} ASS file content
 */
function buildAssFromTranscript(transcript, durationSeconds, style) {
  const t = (transcript || '').trim()
  if (!t || durationSeconds <= 0) return ''

  const raw = t.replace(/\r\n/g, '\n').split(/\n|[.!?]+/)
  const phrases = raw.map((s) => s.trim()).filter(Boolean)
  if (phrases.length === 0) return ''

  const total = Math.max(1, durationSeconds)
  const step = total / phrases.length
  const header = getAssStyleAndHeader(style || 'bottom-black')
  const lines = phrases.map((text, i) => {
    const start = i * step
    const end = (i + 1) * step
    const escaped = text.replace(/\r/g, '').replace(/\n/g, '\\N')
    return `Dialogue: 0,${toAssTime(start)},${toAssTime(end)},Default,,0,0,0,,${escaped}`
  })
  return header + lines.join('\n')
}

/**
 * Export trimmed/cut video using FFmpeg: extract segments, concat, optionally burn captions.
 * @param {Blob} blob - Input video blob (WebM or MP4)
 * @param {Array<{ start: number, end: number }>} segments - Time ranges in seconds
 * @param {object} opts - { onProgress?: (msg) => void, captions?: { transcript?: string, duration?: number, segments?: Array<{ start, end, text }>, style: string } }
 * @returns {Promise<Blob>} Output video blob
 */
export async function exportTrimmedVideo(blob, segments, opts = {}) {
  const report = (msg) => opts.onProgress?.(msg)
  const base = getFfmpegApiBase()
  if (base) return serverExportVideo(base, blob, segments, opts)
  const ffmpeg = await getFFmpeg()
  const isMp4 = blob.type.includes('mp4')
  const ext = isMp4 ? 'mp4' : 'webm'
  const inputName = `input.${ext}`
  const outName = `output.${ext}`
  const captions = opts.captions

  report?.('Loading FFmpeg…')
  const data = new Uint8Array(await blob.arrayBuffer())
  await ffmpeg.writeFile(inputName, data)

  const segFiles = []
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const start = Math.max(0, seg.start)
    const duration = Math.max(0.01, seg.end - seg.start)
    const segName = `seg${i}.${ext}`
    segFiles.push(segName)
    report?.(`Extracting segment ${i + 1}/${segments.length}…`)
    await ffmpeg.exec([
      '-ss', String(start),
      '-i', inputName,
      '-t', String(duration),
      '-c', 'copy',
      '-avoid_negative_ts', '1',
      '-y',
      segName
    ])
  }

  if (segFiles.length === 0) {
    try { await ffmpeg.deleteFile(inputName) } catch (_) {}
    throw new Error('No segments to export')
  }

  const listContent = segFiles.map((f) => `file '${f}'`).join('\n')
  await ffmpeg.writeFile('list.txt', new TextEncoder().encode(listContent))

  report?.('Merging segments…')
  await ffmpeg.exec([
    '-f', 'concat',
    '-safe', '0',
    '-i', 'list.txt',
    '-c', 'copy',
    '-y',
    outName
  ])

  let finalBlob
  const captionSegments = Array.isArray(captions?.segments) && captions.segments.length > 0
  const captionTranscript = captions?.transcript?.trim() && typeof captions.duration === 'number' && captions.duration > 0
  if (captionSegments || captionTranscript) {
    const assContent = captionSegments
      ? buildAssFromSegments(captions.segments, captions.style || 'bottom-black')
      : buildAssFromTranscript(captions.transcript.trim(), captions.duration, captions.style || 'bottom-black')
    if (assContent && assContent.length > 0) {
      report?.('Burning captions…')
      await ffmpeg.writeFile('captions.ass', new TextEncoder().encode(assContent))
      const captionsName = 'captions.ass'
      // Re-encode video with subtitles filter; escape backslashes and colons for filter path
      const filterPath = captionsName.replace(/\\/g, '/').replace(/:/g, '\\:')
      await ffmpeg.exec([
        '-i', outName,
        '-vf', `subtitles=${filterPath}`,
        '-c:a', 'copy',
        '-y',
        'output_with_captions.' + ext
      ])
      const outData = await ffmpeg.readFile('output_with_captions.' + ext)
      finalBlob = outData instanceof Uint8Array
        ? new Blob([outData], { type: blob.type })
        : new Blob([outData.buffer], { type: blob.type })
      try { await ffmpeg.deleteFile('output_with_captions.' + ext) } catch (_) {}
      try { await ffmpeg.deleteFile('captions.ass') } catch (_) {}
    }
  }

  if (!finalBlob) {
    const outData = await ffmpeg.readFile(outName)
    finalBlob = outData instanceof Uint8Array
      ? new Blob([outData], { type: blob.type })
      : new Blob([outData.buffer], { type: blob.type })
  }

  try {
    await ffmpeg.deleteFile(inputName)
    for (const f of segFiles) await ffmpeg.deleteFile(f)
    await ffmpeg.deleteFile('list.txt')
    await ffmpeg.deleteFile(outName)
  } catch (_) {}

  return finalBlob
}

/** OpenAI Whisper API max file size (25 MB). */
export const WHISPER_MAX_BYTES = 25 * 1024 * 1024

/**
 * Extract and compress audio from a video blob for Whisper (stays under 25 MB).
 * Tries fast path (copy) first; only re-encodes if result would exceed 25 MB.
 * @param {Blob} blob - Video blob (WebM, MP4, OGG)
 * @param {object} opts - { onProgress?: (msg: string) => void }
 * @returns {Promise<Blob>} Audio blob (M4A/WebM copy or MP3)
 */
export async function extractAudioForWhisper(blob, opts = {}) {
  const report = (msg) => opts.onProgress?.(msg)
  const base = getFfmpegApiBase()
  if (base && blob.size > WHISPER_MAX_BYTES) return serverExtractAudio(base, blob, opts)
  if (blob.size > WHISPER_MAX_BYTES) {
    throw new Error(
      'Video is over 25 MB. Start the FFmpeg server (npm run server) and add VITE_FFMPEG_API_URL=http://localhost:3030 to your .env file to transcribe.'
    )
  }
  const ffmpeg = await getFFmpeg()
  const ext = inputExtFromType(blob?.type)
  const inputName = `input.${ext}`
  const fastOutName = ext === 'mp4' ? 'audio_fast.m4a' : 'audio_fast.webm'
  const outputName = 'audio.mp3'

  report?.('Preparing file…')
  const data = new Uint8Array(await blob.arrayBuffer())
  await ffmpeg.writeFile(inputName, data)

  // Fast path: extract with -c:a copy (no re-encode). Whisper accepts m4a and webm.
  report?.('Extracting audio…')
  try {
    await ffmpeg.exec([
      '-i', inputName,
      '-vn',
      '-c:a', 'copy',
      '-y',
      fastOutName
    ])
    const fastData = await ffmpeg.readFile(fastOutName)
    const fastSize = fastData?.byteLength ?? (fastData?.buffer?.byteLength ?? 0)
    try { await ffmpeg.deleteFile(fastOutName) } catch (_) {}
    if (fastSize > 0 && fastSize <= WHISPER_MAX_BYTES) {
      const fastBlob = fastData instanceof Uint8Array
        ? new Blob([fastData], { type: ext === 'mp4' ? 'audio/mp4' : 'audio/webm' })
        : new Blob([fastData.buffer], { type: ext === 'mp4' ? 'audio/mp4' : 'audio/webm' })
      try { await ffmpeg.deleteFile(inputName) } catch (_) {}
      return fastBlob
    }
  } catch (_) {
    try { await ffmpeg.deleteFile(fastOutName) } catch (_) {}
  }

  // Re-encode to small MP3 so we stay under 25 MB
  report?.('Compressing audio…')
  const args = [
    '-i', inputName,
    '-vn',
    '-ac', '1',
    '-ar', '16000',
    '-b:a', '64k',
    '-y',
    outputName
  ]
  if (opts.onProgress) {
    const cb = (e) => opts.onProgress(e?.progress != null ? `Encoding… ${Math.round((e.progress ?? 0) * 100)}%` : 'Encoding…')
    ffmpeg.on('progress', cb)
    try {
      await ffmpeg.exec(args)
    } finally {
      ffmpeg.off('progress', cb)
    }
  } else {
    await ffmpeg.exec(args)
  }

  const outData = await ffmpeg.readFile(outputName)
  const outBlob = outData instanceof Uint8Array
    ? new Blob([outData], { type: 'audio/mpeg' })
    : new Blob([outData.buffer], { type: 'audio/mpeg' })

  try {
    await ffmpeg.deleteFile(inputName)
    await ffmpeg.deleteFile(outputName)
  } catch (_) {}

  return outBlob
}

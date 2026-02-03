/**
 * FFmpeg.wasm: convert WebM (or other) blob to high-quality MP4 in the browser.
 * Requires SharedArrayBuffer (COOP/COEP headers in dev server).
 */

import { FFmpeg } from '@ffmpeg/ffmpeg'

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

/**
 * Export trimmed/cut video using FFmpeg: extract segments, concat, output as WebM (or same format as input).
 * @param {Blob} blob - Input video blob (WebM or MP4)
 * @param {Array<{ start: number, end: number }>} segments - Time ranges in seconds
 * @param {object} opts - { onProgress?: (msg: string) => void }
 * @returns {Promise<Blob>} Output video blob
 */
export async function exportTrimmedVideo(blob, segments, opts = {}) {
  const report = (msg) => opts.onProgress?.(msg)
  const ffmpeg = await getFFmpeg()
  const isMp4 = blob.type.includes('mp4')
  const ext = isMp4 ? 'mp4' : 'webm'
  const inputName = `input.${ext}`
  const outName = `output.${ext}`

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

  const outData = await ffmpeg.readFile(outName)
  const outBlob = outData instanceof Uint8Array
    ? new Blob([outData], { type: blob.type })
    : new Blob([outData.buffer], { type: blob.type })

  try {
    await ffmpeg.deleteFile(inputName)
    for (const f of segFiles) await ffmpeg.deleteFile(f)
    await ffmpeg.deleteFile('list.txt')
    await ffmpeg.deleteFile(outName)
  } catch (_) {}

  return outBlob
}

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

/**
 * Convert a video blob (e.g. WebM from MediaRecorder) to high-quality MP4.
 * @param {Blob} blob - Input video blob (WebM or similar)
 * @param {object} opts - { onProgress?: (p) => void }
 * @returns {Promise<Blob>} MP4 blob
 */
export async function convertToMp4(blob, opts = {}) {
  const ffmpeg = await getFFmpeg()
  const inputName = 'input.webm'
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

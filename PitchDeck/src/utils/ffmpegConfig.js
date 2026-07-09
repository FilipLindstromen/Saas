/**
 * FFmpeg-related env and limits only — no @ffmpeg/ffmpeg import.
 * UI and size checks import this so they are not in the same init graph as ffmpegExport.
 */

export function getFfmpegApiBase() {
  if (typeof window !== 'undefined' && window.electronAPI?.ffmpegApiUrl) {
    return String(window.electronAPI.ffmpegApiUrl).trim()
  }
  const url = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_FFMPEG_API_URL
  return (url && String(url).trim()) || ''
}

/** OpenAI Whisper API max file size (25 MB). */
export const WHISPER_MAX_BYTES = 25 * 1024 * 1024

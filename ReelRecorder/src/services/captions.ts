/**
 * Caption burn-in uses OpenAI Whisper for transcription.
 * API key can be set in Settings (stored in browser) or via VITE_OPENAI_API_KEY in .env.
 * Whisper API has a 25 MB limit; we re-encode audio to a smaller blob when over the limit.
 */

const ENV_OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY as string | undefined

/** OpenAI Whisper API maximum file size (25 MB) */
const WHISPER_MAX_BYTES = 25 * 1024 * 1024

/**
 * If the video blob is over Whisper's limit, extract audio and re-encode at low bitrate to stay under 25 MB.
 */
async function ensureUnderWhisperLimit(blob: Blob): Promise<Blob> {
  if (blob.size <= WHISPER_MAX_BYTES) return blob

  const url = URL.createObjectURL(blob)
  try {
    const video = document.createElement('video')
    video.muted = false
    video.preload = 'auto'
    video.playsInline = true

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('Could not load video for audio extraction'))
      video.src = url
    })

    const stream = video.captureStream ? video.captureStream() : (video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream?.()
    if (!stream) throw new Error('Browser does not support capturing stream from video')
    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0) throw new Error('Video has no audio track to transcribe')

    const audioStream = new MediaStream(audioTracks)
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4'
    const recorder = new MediaRecorder(audioStream, {
      audioBitsPerSecond: 32000,
      mimeType,
    })
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    await new Promise<void>((resolve, reject) => {
      video.onended = () => {
        if (recorder.state !== 'inactive') recorder.stop()
      }
      video.onerror = () => reject(new Error('Video playback failed during audio extraction'))
      recorder.onstop = () => resolve()
      recorder.start(1000)
      video.play().catch(reject)
    })
    audioTracks.forEach((t) => t.stop())

    const reencoded = new Blob(chunks, { type: mimeType })
    if (reencoded.size > WHISPER_MAX_BYTES) {
      throw new Error(
        `Recording is too long to transcribe in one go (over 25 MB even after compressing). Try shortening the video or splitting it.`
      )
    }
    return reencoded
  } finally {
    URL.revokeObjectURL(url)
  }
}

export interface CaptionWord {
  word: string
  start: number
  end: number
}

export interface CaptionSegment {
  start: number
  end: number
  text: string
  /** Word-level timestamps when requested from Whisper */
  words?: CaptionWord[]
}

export async function transcribeAudioFromVideo(
  videoBlob: Blob,
  apiKey?: string
): Promise<CaptionSegment[]> {
  const key = (apiKey && apiKey.trim()) || ENV_OPENAI_KEY
  if (!key) {
    throw new Error('OpenAI API key is not set. Open Settings (top right) to add your key.')
  }
  const blobToSend = await ensureUnderWhisperLimit(videoBlob)
  const ext = blobToSend.type.includes('mp4') ? 'mp4' : 'webm'
  const formData = new FormData()
  formData.append('file', blobToSend, `recording.${ext}`)
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'verbose_json')
  formData.append('timestamp_granularities[]', 'segment')
  formData.append('timestamp_granularities[]', 'word')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = err.error?.message || res.statusText || 'Transcription failed'
    if (res.status === 413) {
      throw new Error(
        'File is too large for transcription (max 25 MB). The app tried to compress the audio; if you still see this, try a shorter recording.'
      )
    }
    throw new Error(msg)
  }
  const data = await res.json()
  const segments: CaptionSegment[] = (data.segments || []).map(
    (s: { start: number; end: number; text: string; words?: { word?: string; text?: string; start: number; end: number }[] }) => {
      const words: CaptionWord[] | undefined = s.words?.map(
        (w: { word?: string; text?: string; start: number; end: number }) => ({
          word: (w.word ?? w.text ?? '').trim(),
          start: w.start,
          end: w.end,
        })
      ).filter((w: CaptionWord) => w.word.length > 0)
      return {
        start: s.start,
        end: s.end,
        text: s.text?.trim() || '',
        ...(words && words.length > 0 ? { words } : {}),
      }
    }
  )
  return segments
}

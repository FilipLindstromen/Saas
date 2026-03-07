/**
 * Transcription via OpenAI Whisper. Uses shared API key from saasApiKeys.
 */

const WHISPER_MAX_BYTES = 25 * 1024 * 1024

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
    const stream = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.() ??
      (video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream?.()
    if (!stream) throw new Error('Browser does not support capturing stream from video')
    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0) throw new Error('Video has no audio track to transcribe')
    const audioStream = new MediaStream(audioTracks)
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4'
    const recorder = new MediaRecorder(audioStream, { audioBitsPerSecond: 32000, mimeType })
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
    await new Promise<void>((resolve, reject) => {
      video.onended = () => { if (recorder.state !== 'inactive') recorder.stop() }
      video.onerror = () => reject(new Error('Video playback failed during audio extraction'))
      recorder.onstop = () => resolve()
      recorder.start(1000)
      video.play().catch(reject)
    })
    audioTracks.forEach((t) => t.stop())
    const reencoded = new Blob(chunks, { type: mimeType })
    if (reencoded.size > WHISPER_MAX_BYTES) {
      throw new Error('Recording is too long to transcribe in one go (over 25 MB). Try a shorter video.')
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
  words?: CaptionWord[]
}

export async function transcribeVideo(
  videoBlob: Blob,
  apiKey: string
): Promise<CaptionSegment[]> {
  const key = apiKey?.trim()
  if (!key) throw new Error('OpenAI API key is not set. Open Settings to add your key.')
  const blobToSend = await ensureUnderWhisperLimit(videoBlob)
  const ext = blobToSend.type.includes('mp4') ? 'mp4' : 'webm'
  const formData = new FormData()
  formData.append('file', blobToSend, `video.${ext}`)
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
    const msg = (err as { error?: { message?: string } })?.error?.message || res.statusText || 'Transcription failed'
    if (res.status === 413) throw new Error('File is too large for transcription (max 25 MB). Try a shorter video.')
    throw new Error(msg)
  }
  const data = (await res.json()) as {
    segments?: Array<{
      start: number
      end: number
      text: string
      words?: Array<{ word?: string; text?: string; start: number; end: number }>
    }>
  }
  const segments: CaptionSegment[] = (data.segments || []).map((s) => {
    const words = s.words?.map((w) => ({
      word: (w.word ?? w.text ?? '').trim(),
      start: w.start,
      end: w.end,
    })).filter((w) => w.word.length > 0)
    return {
      start: s.start,
      end: s.end,
      text: s.text?.trim() || '',
      ...(words && words.length > 0 ? { words } : {}),
    }
  })
  return segments
}

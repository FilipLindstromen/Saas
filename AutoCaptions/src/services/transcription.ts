/**
 * Transcription via OpenAI Whisper. Uses shared API key from saasApiKeys.
 */

const WHISPER_MAX_BYTES = 25 * 1024 * 1024

export type TranscribePhase = 'preparing' | 'uploading' | 'processing'

export interface TranscribeProgressUpdate {
  percent: number
  phase: TranscribePhase
  label: string
}

async function ensureUnderWhisperLimit(
  blob: Blob,
  onProgress?: (update: TranscribeProgressUpdate) => void
): Promise<Blob> {
  if (blob.size <= WHISPER_MAX_BYTES) {
    onProgress?.({
      percent: 18,
      phase: 'preparing',
      label: 'Audio ready',
    })
    return blob
  }

  onProgress?.({ percent: 2, phase: 'preparing', label: 'Extracting audio from video…' })

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
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0

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

    const reportPlayback = () => {
      if (!duration || !onProgress) return
      const ratio = Math.min(1, video.currentTime / duration)
      onProgress({
        percent: 2 + ratio * 26,
        phase: 'preparing',
        label: 'Extracting audio from video…',
      })
    }
    video.addEventListener('timeupdate', reportPlayback)

    await new Promise<void>((resolve, reject) => {
      video.onended = () => { if (recorder.state !== 'inactive') recorder.stop() }
      video.onerror = () => reject(new Error('Video playback failed during audio extraction'))
      recorder.onstop = () => resolve()
      recorder.start(1000)
      video.play().catch(reject)
    })

    video.removeEventListener('timeupdate', reportPlayback)
    audioTracks.forEach((t) => t.stop())
    const reencoded = new Blob(chunks, { type: mimeType })
    if (reencoded.size > WHISPER_MAX_BYTES) {
      throw new Error('Recording is too long to transcribe in one go (over 25 MB). Try a shorter video.')
    }
    onProgress?.({ percent: 28, phase: 'preparing', label: 'Audio ready' })
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

function postTranscription(
  formData: FormData,
  apiKey: string,
  onProgress?: (update: TranscribeProgressUpdate) => void
): Promise<CaptionSegment[]> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', 'https://api.openai.com/v1/audio/transcriptions')
    xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`)

    xhr.upload.addEventListener('progress', (event) => {
      if (!onProgress) return
      if (event.lengthComputable && event.total > 0) {
        const uploadRatio = event.loaded / event.total
        onProgress({
          percent: 30 + uploadRatio * 58,
          phase: 'uploading',
          label: 'Uploading audio to OpenAI…',
        })
      } else {
        onProgress({
          percent: 45,
          phase: 'uploading',
          label: 'Uploading audio to OpenAI…',
        })
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        let msg = xhr.statusText || 'Transcription failed'
        try {
          const err = JSON.parse(xhr.responseText) as { error?: { message?: string } }
          if (err?.error?.message) msg = err.error.message
        } catch {
          /* ignore */
        }
        if (xhr.status === 413) {
          reject(new Error('File is too large for transcription (max 25 MB). Try a shorter video.'))
          return
        }
        reject(new Error(msg))
        return
      }

      onProgress?.({ percent: 92, phase: 'processing', label: 'Processing transcript…' })

      let data: {
        segments?: Array<{
          start: number
          end: number
          text: string
          words?: Array<{ word?: string; text?: string; start: number; end: number }>
        }>
      }
      try {
        data = JSON.parse(xhr.responseText)
      } catch {
        reject(new Error('Invalid response from transcription service'))
        return
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

      onProgress?.({ percent: 100, phase: 'processing', label: 'Done' })
      resolve(segments)
    })

    xhr.addEventListener('error', () => reject(new Error('Network error during transcription')))
    xhr.addEventListener('abort', () => reject(new Error('Transcription cancelled')))

    onProgress?.({ percent: 30, phase: 'uploading', label: 'Uploading audio to OpenAI…' })
    xhr.send(formData)
  })
}

export async function transcribeVideo(
  videoBlob: Blob,
  apiKey: string,
  onProgress?: (update: TranscribeProgressUpdate) => void
): Promise<CaptionSegment[]> {
  const key = apiKey?.trim()
  if (!key) throw new Error('OpenAI API key is not set. Open Settings to add your key.')

  onProgress?.({ percent: 0, phase: 'preparing', label: 'Preparing…' })
  const blobToSend = await ensureUnderWhisperLimit(videoBlob, onProgress)
  const ext = blobToSend.type.includes('mp4') ? 'mp4' : 'webm'
  const formData = new FormData()
  formData.append('file', blobToSend, `video.${ext}`)
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'verbose_json')
  formData.append('timestamp_granularities[]', 'segment')
  formData.append('timestamp_granularities[]', 'word')

  return postTranscription(formData, key, onProgress)
}

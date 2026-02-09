/**
 * Caption burn-in uses OpenAI Whisper for transcription.
 * API key can be set in Settings (stored in browser) or via VITE_OPENAI_API_KEY in .env.
 */

const ENV_OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY as string | undefined

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
  const formData = new FormData()
  formData.append('file', videoBlob, 'recording.webm')
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'verbose_json')
  formData.append('timestamp_granularities[]', 'segment')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || res.statusText || 'Transcription failed')
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

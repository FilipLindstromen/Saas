/**
 * Whisper transcription with word-level segments (for video editing).
 */
export async function transcribeWithSegments(blob, apiKey) {
  if (!apiKey?.trim()) {
    throw new Error('OpenAI API key not set.')
  }

  const form = new FormData()
  const file = blob instanceof File ? blob : new File([blob], 'audio.mp3', { type: blob.type || 'audio/mpeg' })
  form.append('file', file)
  form.append('model', 'whisper-1')
  form.append('response_format', 'verbose_json')
  form.append('timestamp_granularities[]', 'word')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey.trim()}` },
    body: form,
  })

  if (!res.ok) {
    let message = `Transcription failed (${res.status})`
    try {
      const err = await res.json()
      if (err?.error?.message) message = err.error.message
    } catch (_) {}
    throw new Error(message)
  }

  const data = await res.json()
  const words = Array.isArray(data.words) ? data.words : []
  const segments = words.map((w) => ({
    text: String(w.word || '').trim(),
    start: Number(w.start) || 0,
    end: Number(w.end) || 0,
  })).filter((s) => s.text)

  return {
    transcript: typeof data.text === 'string' ? data.text.trim() : segments.map((s) => s.text).join(' '),
    segments,
  }
}

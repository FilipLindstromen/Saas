export interface WordTimestamp {
  word: string
  start: number
  end: number
}

export interface TranscriptionResult {
  text: string
  words: WordTimestamp[]
}

export async function transcribeAudio(
  audioBlob: Blob,
  apiKey: string
): Promise<TranscriptionResult> {
  const formData = new FormData()
  formData.append('file', audioBlob, 'audio.webm')
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'verbose_json')
  formData.append('timestamp_granularities[]', 'word')

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error?.message || 'Transcription failed')
  }

  const data = await response.json()
  
  // Extract word-level timestamps
  const words: WordTimestamp[] = []
  if (data.words && Array.isArray(data.words)) {
    words.push(...data.words.map((w: any) => ({
      word: w.word,
      start: w.start,
      end: w.end,
    })))
  }

  return {
    text: data.text || '',
    words,
  }
}


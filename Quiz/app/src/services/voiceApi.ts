const OPENAI_TTS_ENDPOINT = 'https://api.openai.com/v1/audio/speech'

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export interface VoiceOverOptions {
  voice?: string
  model?: string
  format?: 'mp3' | 'wav'
}

export interface VoiceOverResult {
  dataUrl: string
  format: 'mp3' | 'wav'
  voice: string
}

export async function generateVoiceOverFromOpenAI(apiKey: string, text: string, options: VoiceOverOptions = {}): Promise<VoiceOverResult> {
  if (!apiKey) {
    throw new Error('Missing OpenAI API key')
  }

  const voice = options.voice ?? 'alloy'
  const model = options.model ?? 'gpt-4o-mini-tts'
  const format = options.format ?? 'mp3'

  const response = await fetch(OPENAI_TTS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': `audio/${format}`
    },
    body: JSON.stringify({
      model,
      input: text,
      voice,
      format
    })
  })

  if (!response.ok) {
    let errorMessage = `OpenAI voice generation failed (${response.status})`
    try {
      const errorData = await response.json()
      if (errorData?.error?.message) {
        errorMessage = errorData.error.message
      }
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(errorMessage)
  }

  const arrayBuffer = await response.arrayBuffer()
  const base64 = arrayBufferToBase64(arrayBuffer)
  const dataUrl = `data:audio/${format};base64,${base64}`

  return { dataUrl, format, voice }
}




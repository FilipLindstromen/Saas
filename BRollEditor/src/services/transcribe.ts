// @ts-ignore - shared module is JS
import { transcribeAudioWithWordTimestamps } from '@shared/openai'
import { punctuateWords } from './wordAlign'
import type { Word } from '../types'

export async function transcribe(blob: Blob, apiKey: string): Promise<{ words: Word[]; text: string }> {
  const { words, text } = await transcribeAudioWithWordTimestamps(blob, apiKey)
  return { words: punctuateWords(words, text), text }
}

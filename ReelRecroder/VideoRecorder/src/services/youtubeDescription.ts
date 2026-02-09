/**
 * Generate a YouTube-optimized description/caption from transcription segments.
 * Uses OpenAI to create an engaging description with optional timestamps.
 */

import type { CaptionSegment } from './captions'

const ENV_OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY as string | undefined

export async function generateYouTubeCaption(
  segments: CaptionSegment[],
  apiKey?: string
): Promise<string> {
  const key = (apiKey && apiKey.trim()) || ENV_OPENAI_KEY
  if (!key) {
    throw new Error('OpenAI API key is not set. Open Settings to add your key.')
  }
  const transcript = segments
    .map((s) => `[${formatTs(s.start)}] ${s.text}`)
    .join('\n')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a YouTube description writer. Given a transcript with timestamps, write a short video description that works great on YouTube.

Rules:
- First line: one short, catchy hook (under 100 chars) that makes people want to watch.
- Then 1-3 short paragraphs summarizing what the video is about (from the transcript).
- Optionally end with a "Timestamps" section listing key moments with MM:SS format (e.g. "0:00 - Intro").
- Use clear, engaging language. No hashtag spam. No "like and subscribe" in the description.
- Output only the description text, no meta-commentary.`,
        },
        {
          role: 'user',
          content: `Transcript:\n\n${transcript}\n\nWrite the YouTube description:`,
        },
      ],
      max_tokens: 800,
      temperature: 0.6,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || res.statusText || 'Failed to generate caption')
  }
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('Empty response from OpenAI')
  return text
}

function formatTs(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

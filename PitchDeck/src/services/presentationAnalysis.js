/**
 * Transcribe recording audio using OpenAI Whisper API.
 * @param {Blob} blob - Video/audio blob (e.g. webm from MediaRecorder)
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<string>} - Transcript text
 */
export async function transcribeRecording(blob, apiKey) {
  const formData = new FormData()
  formData.append('file', blob, blob.name || 'recording.webm')
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'text')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || res.statusText || 'Transcription failed')
  }

  const text = await res.text()
  return (text || '').trim()
}

/**
 * Get presentation coaching feedback from OpenAI (overall + per-slide).
 * @param {string} transcript - Full transcript from Whisper
 * @param {string[]} slideTitles - List of slide titles/headings for context
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<{ strengths: string[], content: string, pacing: string, improvements: string[], slideFeedback: Array<{ slideIndex: number, slideTitle: string, whatWorked: string, suggestion: string }> }>}
 */
export async function getPresentationFeedback(transcript, slideTitles, apiKey) {
  const slideContext = slideTitles.length
    ? `Slide structure (in order): ${slideTitles.map((t, i) => `${i + 1}. ${t || '(no title)'}`).join('; ')}`
    : 'No slide titles provided.'

  const systemPrompt = `You are an expert presentation coach. Your goal is to help the presenter improve.

Analyze the transcript and optional slide structure. Infer which parts of the transcript likely correspond to which slides (by order and content). Then respond with a JSON object (no markdown, no code block) containing exactly these keys:

1) Overall feedback:
- "strengths": array of 2-4 short strings (what they did well: clarity, structure, engagement, etc.)
- "content": one short paragraph on content quality (clarity of message, structure, relevance to slides)
- "pacing": one short paragraph on pacing and speed (too fast, too slow, variation, pauses, filler words)
- "improvements": array of 3-5 short, actionable strings (specific things to try next time)

2) Per-slide feedback (so they can improve slide by slide):
- "slideFeedback": array of objects, one per slide in order. Each object must have:
  - "slideIndex": number (0-based index of the slide)
  - "slideTitle": string (the slide title or "Slide N" if missing)
  - "whatWorked": string (one short sentence: what was strong for this slide, or what they said well)
  - "suggestion": string (one short, actionable suggestion for this slide specifically; e.g. "On this slide you could add a clear takeaway" or "Consider pausing after the stat to let it land")

If there are no slides, slideFeedback can be an empty array. For each slide in the structure, provide one slideFeedback entry. Be constructive and specific. Reference what they likely said on that part of the transcript where you can.`

  const userContent = `${slideContext}\n\nTranscript:\n${transcript || '(No speech detected.)'}`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: 2048,
      temperature: 0.5,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || res.statusText || 'Feedback request failed')
  }

  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content?.trim() || '{}'

  try {
    const parsed = JSON.parse(raw)
    const slideFeedback = Array.isArray(parsed.slideFeedback)
      ? parsed.slideFeedback
          .filter((s) => s && typeof s.slideIndex === 'number')
          .map((s) => ({
            slideIndex: Number(s.slideIndex),
            slideTitle: typeof s.slideTitle === 'string' ? s.slideTitle : `Slide ${(s.slideIndex || 0) + 1}`,
            whatWorked: typeof s.whatWorked === 'string' ? s.whatWorked : '',
            suggestion: typeof s.suggestion === 'string' ? s.suggestion : '',
          }))
      : []
    return {
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      content: typeof parsed.content === 'string' ? parsed.content : '',
      pacing: typeof parsed.pacing === 'string' ? parsed.pacing : '',
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
      slideFeedback,
    }
  } catch (e) {
    return {
      strengths: [],
      content: '',
      pacing: '',
      improvements: [],
      slideFeedback: [],
      raw,
    }
  }
}

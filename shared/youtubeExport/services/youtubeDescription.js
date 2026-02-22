/**
 * Generate YouTube-optimized description from transcription segments or plain text.
 * Shared module for Reel Recorder, StoryWriter, and other Saas apps.
 */

/**
 * @param {Array<{ start: number; text: string }>} segments - Caption segments with timestamps
 * @param {string} [apiKey] - OpenAI API key
 */
export async function generateYouTubeCaptionFromSegments(segments, apiKey) {
  const key = (apiKey && apiKey.trim()) || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENAI_API_KEY);
  if (!key) {
    throw new Error('OpenAI API key is not set. Open Settings to add your key.');
  }
  const formatTs = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };
  const transcript = segments.map((s) => `[${formatTs(s.start)}] ${s.text}`).join('\n');
  return callOpenAI(key, transcript, true);
}

/**
 * @param {string} text - Plain text content (e.g. story, article)
 * @param {string} [apiKey] - OpenAI API key
 */
export async function generateYouTubeDescriptionFromText(text, apiKey) {
  const key = (apiKey && apiKey.trim()) || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENAI_API_KEY);
  if (!key) {
    throw new Error('OpenAI API key is not set. Open Settings to add your key.');
  }
  if (!text || !text.trim()) {
    throw new Error('No content to generate description from.');
  }
  return callOpenAI(key, text.trim(), false);
}

async function callOpenAI(apiKey, content, hasTimestamps) {
  const systemContent = hasTimestamps
    ? `You are a YouTube description writer. Given a transcript with timestamps, write a short video description that works great on YouTube.

Rules:
- First line: one short, catchy hook (under 100 chars) that makes people want to watch.
- Then 1-3 short paragraphs summarizing what the video is about (from the transcript).
- Optionally end with a "Timestamps" section listing key moments with MM:SS format (e.g. "0:00 - Intro").
- Use clear, engaging language. No hashtag spam. No "like and subscribe" in the description.
- Output only the description text, no meta-commentary.`
    : `You are a YouTube description writer. Given content (a story, article, or script), write a short video description that works great on YouTube.

Rules:
- First line: one short, catchy hook (under 100 chars) that makes people want to watch.
- Then 1-3 short paragraphs summarizing the content.
- Use clear, engaging language. No hashtag spam. No "like and subscribe" in the description.
- Output only the description text, no meta-commentary.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemContent },
        {
          role: 'user',
          content: hasTimestamps
            ? `Transcript:\n\n${content}\n\nWrite the YouTube description:`
            : `Content:\n\n${content}\n\nWrite the YouTube description:`,
        },
      ],
      max_tokens: 800,
      temperature: 0.6,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || res.statusText || 'Failed to generate caption');
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty response from OpenAI');
  return text;
}

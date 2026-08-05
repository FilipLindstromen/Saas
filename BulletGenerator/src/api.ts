import { BULLET_TEMPLATE_GUIDE } from './bulletTemplates';

export async function generateBulletsWithOpenAI(
  apiKey: string,
  topic: string
): Promise<string> {
  const trimmed = topic.trim();
  if (!trimmed) {
    throw new Error('Describe your offer, audience, or topic first.');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert direct-response copywriter who writes "sexy" bullet points for sales pages, VSLs, and emails.

${BULLET_TEMPLATE_GUIDE}`,
        },
        {
          role: 'user',
          content: `Write bullet points for this offer/topic (use as many of the 19 templates as fit—vary the patterns):

${trimmed}`,
        },
      ],
      temperature: 0.85,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `API error: ${response.status}`);
  }

  const data = await response.json();
  let text = (data.choices?.[0]?.message?.content ?? '').trim();
  if (!text) return text;
  // Normalize to dash bullets
  text = text
    .split('\n')
    .map((line: string) => {
      const t = line.trim();
      if (!t) return '';
      if (/^[-•*]\s/.test(t)) return t.startsWith('-') ? t : `- ${t.replace(/^[-•*]\s*/, '')}`;
      if (/^\d+[.)]\s/.test(t)) return `- ${t.replace(/^\d+[.)]\s*/, '')}`;
      return `- ${t}`;
    })
    .filter(Boolean)
    .join('\n');
  return text;
}

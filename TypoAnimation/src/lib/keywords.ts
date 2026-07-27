import type { Scene } from '@/types/project';
import { getSharedApiKey } from './env';

// Same spirit as PitchDeck's getSlideSearchKeywords/extractImportantKeywords
// (Saas/PitchDeck/src/utils/mediaSearchQuery.js): strip common stop-words, score by word
// length (favoring more distinctive/longer words), take the top N.
const STOP_WORDS = new Set([
  'the','a','an','and','or','but','if','then','than','so','to','of','in','on','at','for','with',
  'by','from','up','down','out','off','over','under','again','further','is','are','was','were',
  'be','been','being','have','has','had','do','does','did','will','would','should','could','can',
  'this','that','these','those','you','your','i','me','my','we','our','us','it','its','they',
  'them','their','he','she','him','her','his','not','no','yes','as','it\'s','into','about','just',
  'now','within','minutes','seconds','get','got','one','two','three',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function extractImportantKeywords(text: string, maxWords = 3): string {
  const words = tokenize(text).filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
  const unique = [...new Set(words)];
  unique.sort((a, b) => {
    const scoreA = a.length + (counts.get(a) === 1 ? 2 : 0);
    const scoreB = b.length + (counts.get(b) === 1 ? 2 : 0);
    return scoreB - scoreA;
  });
  return unique.slice(0, maxWords).join(' ');
}

export function sceneSearchText(scene: Scene): string {
  const parts: string[] = [];
  if (scene.kicker) parts.push(scene.kicker);
  parts.push(...scene.lines.map((l) => l.text));
  if (scene.compareRows) parts.push(...scene.compareRows.map((r) => r.label));
  return parts.join(' ');
}

// Cheap keyword extraction by default; if an OpenAI key is available (shared from the
// monorepo root .env), ask it to turn those keywords into a tighter stock-footage search
// query — same two-step flow as PitchDeck's generateMediaSearchQuery, with the same
// fail-open behavior (any error just falls back to the plain keyword string).
export async function generateBrollSearchQuery(scene: Scene): Promise<string> {
  const keywords = extractImportantKeywords(sceneSearchText(scene), 3) || 'abstract background';
  const openaiKey = getSharedApiKey('OPENAI_API_KEY');
  if (!openaiKey) return keywords;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        max_tokens: 15,
        messages: [
          {
            role: 'system',
            content:
              'You turn a few keywords into a 2-3 word search query for stock b-roll footage (Pexels/Pixabay). Reply with only the search query, no quotes or punctuation.',
          },
          { role: 'user', content: keywords },
        ],
      }),
    });
    if (!res.ok) return keywords;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return keywords;
    const cleaned = raw.replace(/["'.]/g, '').split(/\s+/).slice(0, 4).join(' ');
    return cleaned || keywords;
  } catch {
    return keywords;
  }
}

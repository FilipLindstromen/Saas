import { POSTIT_ICONS } from '../constants/icons';

const ICON_IDS = POSTIT_ICONS.filter((i) => i.id !== 'none').map((i) => i.id);

/**
 * Ask OpenAI to pick the best icon for a note's text.
 * @param {string} noteText - The text content of the post-it
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<string>} - Icon id from our set, or 'none' on error
 */
export async function suggestIconForNote(noteText, apiKey) {
  if (!apiKey?.trim()) return 'none';
  const text = (noteText || '').trim();
  if (!text) return 'none';

  const prompt = `You are helping pick a single icon for a note/card. The note text is:

"${text.slice(0, 500)}"

Choose exactly ONE icon from this list that best represents the note's topic or purpose. Reply with ONLY the icon id, nothing else. No explanation.

Available icon ids: ${ICON_IDS.join(', ')}

If none fit well, reply: none`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 20,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || res.statusText || 'OpenAI request failed');
    }

    const data = await res.json();
    const choice = data.choices?.[0]?.message?.content?.trim?.();
    if (!choice) return 'none';

    const id = choice.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (id === 'none') return 'none';
    if (ICON_IDS.includes(id)) return id;
    return 'none';
  } catch (e) {
    console.warn('OpenAI icon suggestion failed:', e);
    return 'none';
  }
}

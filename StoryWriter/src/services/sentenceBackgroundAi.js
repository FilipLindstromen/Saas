import { generateImage } from '@shared/openai';
import { searchUnsplashFirst } from '@shared/stockMedia/unsplash';
import { getSettings } from '../utils/settings';

export function buildNapkinSketchBackgroundPrompt(sentenceText, instructions = '') {
  const theme = String(sentenceText ?? '').trim().slice(0, 400);
  const extra = String(instructions ?? '').trim().slice(0, 500);
  const parts = [
    'Create a high-resolution presentation background illustration.',
    'Visual style: minimalist hand-drawn whiteboard or napkin sketch — black marker linework on a clean white background, simple stick-figure people optional, occasional soft yellow highlighter strokes for emphasis, lots of white space.',
    'Lines should feel hand-drawn but crisp, sharp, and high quality (not blurry, not photorealistic).',
    'Do not include any text, letters, numbers, logos, signatures, or watermarks.',
    'Landscape 16:9 composition that works behind semi-transparent story text.',
  ];
  if (theme) {
    parts.push(`Illustrate the idea and mood of this sentence without writing words: "${theme}".`);
  } else {
    parts.push('Simple brainstorming doodle with icons suggesting ideas and conversation.');
  }
  if (extra) {
    parts.push(`Additional creative direction from the author: ${extra}`);
  }
  return parts.join(' ');
}

export async function generateNapkinSketchBackground(sentenceText, apiKey, instructions = '') {
  const prompt = buildNapkinSketchBackgroundPrompt(sentenceText, instructions);
  return generateImage({
    prompt,
    size: '1536x1024',
    quality: 'high',
    apiKey,
  });
}

/**
 * @param {{ sentenceText: string, source: 'unsplash' | 'ai-sketch' | 'import', openaiApiKey?: string, sketchInstructions?: string }} options
 * @returns {Promise<{ url: string, credit: string } | null>}
 */
export async function resolveSentenceBackgroundImage({ sentenceText, source, openaiApiKey, sketchInstructions }) {
  const text = String(sentenceText ?? '').trim();
  if (!text) return null;
  if (source === 'import') return null;

  if (source === 'ai-sketch') {
    const key = openaiApiKey?.trim();
    if (!key) throw new Error('Add your OpenAI API key in Settings to generate sketch backgrounds.');
    const instructions =
      sketchInstructions !== undefined ? sketchInstructions : getSettings().editSketchGenerationInstructions;
    const url = await generateNapkinSketchBackground(text, key, instructions);
    return url ? { url, credit: 'AI napkin sketch' } : null;
  }

  return searchUnsplashFirst(text);
}

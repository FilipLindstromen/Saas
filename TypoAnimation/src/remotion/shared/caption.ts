import type { Scene } from '@/types/project';
import { stripInlineHighlightMarkup } from '@/lib/inlineHighlight';

// The text burned into the caption bar (and used as the VO-reference chrome caption) when
// a scene has no explicit override — kicker + all line text, joined.
export function sceneCaptionText(scene: Scene): string {
  const parts: string[] = [];
  if (scene.kicker) parts.push(stripInlineHighlightMarkup(scene.kicker));
  parts.push(...scene.lines.map((l) => stripInlineHighlightMarkup(l.text)));
  return parts.join(' ');
}

/** Strip [[ ]] markers for width measurement, word counts, and plain-text fallbacks. */
export function stripInlineHighlightMarkup(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text.startsWith('[[', i)) {
      i += 2;
      continue;
    }
    if (text.startsWith(']]', i)) {
      i += 2;
      continue;
    }
    out += text[i];
    i++;
  }
  return out;
}

/** Unclosed [[ count after scanning (0 = all highlights closed). */
export function inlineHighlightDepth(text: string): number {
  let depth = 0;
  let i = 0;
  while (i < text.length - 1) {
    if (text[i] === '[' && text[i + 1] === '[') {
      depth++;
      i += 2;
      continue;
    }
    if (text[i] === ']' && text[i + 1] === ']') {
      depth = Math.max(0, depth - 1);
      i += 2;
      continue;
    }
    i++;
  }
  return depth;
}

/** Split textarea lines without breaking in the middle of a [[ … ]] span. */
export function splitSceneLinesPreservingHighlights(text: string): string[] {
  const result: string[] = [];
  let buffer = '';

  for (const rawLine of text.split('\n')) {
    buffer = buffer ? `${buffer}\n${rawLine}` : rawLine;
    if (inlineHighlightDepth(buffer) === 0) {
      result.push(buffer);
      buffer = '';
    }
  }
  if (buffer) result.push(buffer);

  return result;
}

export interface InlineHighlightSegment {
  text: string;
  highlighted: boolean;
}

/** Parse [[highlighted]] spans; supports multiline content in one string. */
export function parseInlineHighlightSegments(text: string): InlineHighlightSegment[] {
  const segments: InlineHighlightSegment[] = [];
  let i = 0;
  let highlighted = false;

  while (i < text.length) {
    if (text.startsWith('[[', i)) {
      highlighted = true;
      i += 2;
      continue;
    }
    if (text.startsWith(']]', i)) {
      highlighted = false;
      i += 2;
      continue;
    }
    let j = i;
    while (j < text.length && !text.startsWith('[[', j) && !text.startsWith(']]', j)) j++;
    const chunk = text.slice(i, j);
    if (chunk) segments.push({ text: chunk, highlighted });
    i = j;
  }

  return segments;
}

export interface HighlightWordToken {
  word: string;
  highlighted: boolean;
  /** index of segment — words in the same segment share one continuous background */
  segmentIndex: number;
}

export function tokenizeInlineHighlightWords(text: string): HighlightWordToken[] {
  const segments = parseInlineHighlightSegments(text);
  const tokens: HighlightWordToken[] = [];
  segments.forEach((seg, segmentIndex) => {
    const normalized = seg.text.replace(/\s+/g, ' ').trim();
    if (!normalized) return;
    for (const word of normalized.split(' ')) {
      if (word) tokens.push({ word, highlighted: seg.highlighted, segmentIndex });
    }
  });
  return tokens;
}

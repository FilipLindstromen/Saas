/** Split text into sentences (by . ! ? followed by space or end). */
export function getSentences(text) {
  if (!text || !String(text).trim()) return [];
  const trimmed = String(text).trim();
  return trimmed
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Return { sentences, starts } where starts[i] is the character offset of sentence i in normalized content. */
export function getSentenceStarts(content) {
  const normalized = String(content ?? '').trim().replace(/\n+/g, ' ');
  const sentences = getSentences(normalized);
  const starts = [];
  let idx = 0;
  for (const s of sentences) {
    const found = normalized.indexOf(s, idx);
    if (found >= 0) {
      starts.push(found);
      idx = found + s.length;
    }
  }
  return { sentences, starts };
}

/** Map a selection start offset in raw content to normalized content offset (newlines → single space). */
export function contentOffsetToNormalized(content, selectionStart) {
  const before = String(content).slice(0, selectionStart);
  return before.replace(/\n+/g, ' ').length;
}

/** Given normalized offset and sentence starts, return the sentence index (0-based). */
export function normalizedOffsetToSentenceIndex(normalizedOffset, starts) {
  if (!starts.length) return 0;
  for (let i = starts.length - 1; i >= 0; i--) {
    if (normalizedOffset >= starts[i]) return i;
  }
  return 0;
}

/** Map normalized content offset to raw content offset (for highlight layer). */
export function normalizedOffsetToRawOffset(content, normOff) {
  const s = String(content ?? '');
  let norm = 0;
  let inNl = false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\n') {
      if (!inNl) {
        inNl = true;
        norm++;
      }
    } else {
      inNl = false;
      norm++;
    }
    if (norm > normOff) return i;
  }
  return s.length;
}

/** Return segments of raw content for highlight layer: [{ start, end, hasImage }, ...]. */
export function getSentenceSegments(content, sentenceImages = []) {
  const normalized = String(content ?? '').trim().replace(/\n+/g, ' ');
  const { sentences, starts } = getSentenceStarts(content);
  if (!sentences.length) return [];
  const segments = [];
  for (let i = 0; i < sentences.length; i++) {
    const normStart = starts[i];
    const normEnd = normStart + sentences[i].length;
    const rawStart = normalizedOffsetToRawOffset(content, normStart);
    const rawEnd = normalizedOffsetToRawOffset(content, normEnd);
    segments.push({
      start: rawStart,
      end: rawEnd,
      hasImage: Boolean(sentenceImages[i]),
    });
  }
  return segments;
}

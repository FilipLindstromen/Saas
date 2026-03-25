/**
 * Split long transcripts into segments for multi-pass organization (token / payload safety).
 * Prefers paragraph boundaries; hard-splits only when a single block exceeds maxChars.
 */

const ROUGH_CHARS_PER_TOKEN = 4;

export function estimateTranscriptTokens(text: string): number {
  return Math.ceil((text?.length ?? 0) / ROUGH_CHARS_PER_TOKEN);
}

export function splitTranscriptIntoChunks(text: string, maxChars: number): string[] {
  const t = text.trim();
  if (!t) return [];
  if (t.length <= maxChars) return [t];

  const paragraphs = t.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    const s = current.trim();
    if (s) chunks.push(s);
    current = "";
  };

  for (const p of paragraphs) {
    const para = p.trim();
    if (!para) continue;
    if (para.length > maxChars) {
      flush();
      chunks.push(...hardSplit(para, maxChars));
      continue;
    }
    const combined = current ? `${current}\n\n${para}` : para;
    if (combined.length > maxChars && current) {
      flush();
      current = para;
    } else {
      current = combined;
    }
  }
  flush();
  return chunks;
}

function hardSplit(s: string, maxChars: number): string[] {
  if (s.length <= maxChars) return [s];
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    let end = Math.min(i + maxChars, s.length);
    if (end < s.length) {
      const slice = s.slice(i, end);
      const breakAt = Math.max(slice.lastIndexOf("\n"), slice.lastIndexOf(". "), slice.lastIndexOf(" "));
      if (breakAt > maxChars * 0.5) end = i + breakAt + 1;
    }
    const piece = s.slice(i, end).trim();
    if (piece) out.push(piece);
    i = end;
  }
  return out;
}

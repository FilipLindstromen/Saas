import { createScene, type Scene } from '@/types/project';

export interface ParsedBlock {
  name: string;
  kicker: string | null;
  lines: { text: string; accent?: boolean }[];
}

// Parses the "### SceneName / ^ kicker / > accent line" copy-script format — a direct port
// of the reference prototype's `parseCopyScript`. Returns one block per "### " header.
export function parseStructuredScript(text: string): ParsedBlock[] {
  if (!text) return [];
  const blocks = String(text).split(/\n(?=###\s)/);
  const out: ParsedBlock[] = [];
  for (const block of blocks) {
    const m = block.match(/^###\s*(.+?)\s*\n?([\s\S]*)$/);
    if (!m) continue;
    const name = m[1].trim();
    if (!name) continue;
    let kicker: string | null = null;
    const lines: { text: string; accent?: boolean }[] = [];
    for (const raw of m[2].split('\n')) {
      const l = raw.trim();
      if (!l) continue;
      if (l.startsWith('^ ')) kicker = l.slice(2).trim();
      else if (l.startsWith('> ')) lines.push({ text: l.slice(2).trim(), accent: true });
      else lines.push({ text: l });
    }
    out.push({ name, kicker, lines });
  }
  return out;
}

function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

// A comfortable on-screen duration for a scene given how much text it has to reveal
// word-by-word (0.055s/word stagger inside Line) plus a reading-along buffer.
function estimateDuration(kicker: string | null | undefined, lines: { text: string }[]): number {
  const words = (kicker ? wordCount(kicker) : 0) + lines.reduce((n, l) => n + wordCount(l.text), 0);
  return Math.min(6.5, Math.max(2.2, 1.6 + words * 0.22));
}

function toScene(name: string, kicker: string | null | undefined, lines: { text: string; accent?: boolean }[]): Scene {
  return createScene({
    name,
    style: 'plain',
    lines,
    kicker: kicker || undefined,
    durationSec: estimateDuration(kicker, lines),
  });
}

// Freeform-paste fallback: no "### " headers present, so split on blank lines (paragraph
// boundaries) into one scene per paragraph, one Line per non-empty source line within it.
function parseFreeform(text: string): Scene[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return paragraphs.map((para, i) => {
    const lines = para
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => ({ text: l }));
    return toScene(`Scene ${i + 1}`, null, lines);
  });
}

// Entry point for the "paste your script" box: tries the structured "### Name" format
// first, falls back to auto-splitting freeform pasted text by paragraph.
export function parseScript(text: string): Scene[] {
  if (!text || !text.trim()) return [];
  if (/(^|\n)###\s/.test(text)) {
    return parseStructuredScript(text).map((b) => toScene(b.name, b.kicker, b.lines));
  }
  return parseFreeform(text);
}

// Serializes scenes back into the "### Name / ^ kicker / > accent" editable script format,
// for round-tripping through the raw-text editor view.
export function serializeScript(scenes: Scene[]): string {
  return scenes
    .map((s) => {
      const parts = [`### ${s.name}`];
      if (s.kicker) parts.push(`^ ${s.kicker}`);
      for (const l of s.lines) parts.push(l.accent ? `> ${l.text}` : l.text);
      return parts.join('\n');
    })
    .join('\n\n');
}

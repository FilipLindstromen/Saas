import { createScene, type Scene, type SceneLine, type SceneStyle } from '@/types/project';

export interface ParsedBlock {
  name: string;
  kicker: string | null;
  lines: { text: string; accent?: boolean }[];
}

// Parses the "### SceneName / ^ kicker / > accent line" copy-script format. Scene boundaries
// are blank lines (a paragraph = a scene): a single line break adds a line to the current
// scene, a blank line starts a new one. The "### Name" header is optional per-paragraph —
// when present it names the scene and is stripped from the body; when absent the scene is
// auto-named. This means pasted text never needs "### " headers to split into scenes, only
// blank lines between them.
export function parseStructuredScript(text: string): ParsedBlock[] {
  if (!text) return [];
  const blocks = String(text)
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const out: ParsedBlock[] = [];
  for (const block of blocks) {
    const blockLines = block.split('\n');
    const headerMatch = blockLines[0].match(/^###\s*(.+?)\s*$/);
    const bodyLines = headerMatch ? blockLines.slice(1) : blockLines;
    const name = (headerMatch && headerMatch[1].trim()) || `Scene ${out.length + 1}`;
    let kicker: string | null = null;
    const lines: { text: string; accent?: boolean }[] = [];
    for (const raw of bodyLines) {
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

// A line that's just a bare number, optionally with a directly-attached short symbol
// ("90", "50%", "10x", "3+") — deliberately tight so it only catches unambiguous stat
// callouts, not any line that happens to contain a number ("90 seconds later" doesn't match).
const BIG_NUMBER_LINE = /^(\d+(?:\.\d+)?)([%xX+]?)$/;

function extractBigNumber(lines: SceneLine[]): { number: number; suffix?: string; rest: SceneLine[] } | null {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].text.trim().match(BIG_NUMBER_LINE);
    if (!m) continue;
    const number = Number(m[1]);
    if (!Number.isFinite(number)) continue;
    return { number, suffix: m[2] || undefined, rest: lines.slice(0, i).concat(lines.slice(i + 1)) };
  }
  return null;
}

// Picks a scene style from its content: a standalone number line reads as a stat callout, a
// run of 3+ short phrases reads as a tag/feature list, and a line or two of few words reads as
// a punchy poster statement — anything longer/more prose-like stays the general-purpose
// word-by-word default. Styles that need data this parser can't infer from plain text
// (comparison rows, rotating words, b-roll footage) are left for manual selection afterward.
function pickSceneStyle(kicker: string | null | undefined, lines: SceneLine[]): SceneStyle {
  if (extractBigNumber(lines)) return 'bignumber';
  if (lines.length >= 3 && lines.every((l) => wordCount(l.text) <= 3)) return 'chips';
  const totalWords = (kicker ? wordCount(kicker) : 0) + lines.reduce((n, l) => n + wordCount(l.text), 0);
  if (lines.length > 0 && lines.length <= 2 && totalWords <= 8) return 'poster';
  return 'plain';
}

function toScene(name: string, kicker: string | null | undefined, lines: SceneLine[]): Scene {
  const style = pickSceneStyle(kicker, lines);
  const big = style === 'bignumber' ? extractBigNumber(lines) : null;
  const finalLines = big ? big.rest : lines;
  return createScene({
    name,
    style,
    lines: finalLines,
    kicker: kicker || undefined,
    durationSec: estimateDuration(kicker, finalLines),
    number: big ? big.number : undefined,
    numberSuffix: big?.suffix,
    dark: style === 'poster' ? true : undefined,
  });
}

// Entry point for the "paste your script" box: blank lines split scenes, "### Name" headers
// are an optional way to name a scene explicitly, "^ " marks a kicker line, "> " marks an
// accent line, and everything else is a plain line.
export function parseScript(text: string): Scene[] {
  if (!text || !text.trim()) return [];
  return parseStructuredScript(text).map((b) => toScene(b.name, b.kicker, b.lines));
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

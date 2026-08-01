import { createScene, type Scene, type SceneLine, type SceneStyle } from '@/types/project';
import { splitSceneLinesPreservingHighlights } from '@/lib/inlineHighlight';

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
    const bodyText = bodyLines.join('\n');
    const logicalLines = splitSceneLinesPreservingHighlights(bodyText);
    let kicker: string | null = null;
    const lines: { text: string; accent?: boolean }[] = [];
    for (const raw of logicalLines) {
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

export function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

// A comfortable on-screen duration for a scene given how much text it has to reveal
// word-by-word (0.055s/word stagger inside Line) plus a reading-along buffer. Exported so the
// editor can re-fit a scene's duration to its content live, whenever it's edited after the
// initial generation (see patchScene in page.tsx) — not just at parse time.
export function estimateDuration(kicker: string | null | undefined, lines: { text: string }[]): number {
  const words = (kicker ? wordCount(kicker) : 0) + lines.reduce((n, l) => n + wordCount(l.text), 0);
  return Math.min(6.5, Math.max(2.2, 1.6 + words * 0.22));
}

// A line that's just a bare number, optionally with a directly-attached short symbol
// ("90", "50%", "10x", "3+") — deliberately tight so it only catches unambiguous stat
// callouts, not any line that happens to contain a number ("90 seconds later" doesn't match).
const BIG_NUMBER_LINE = /^(\d+(?:\.\d+)?)([%xX+]?)$/;

export function extractBigNumber(lines: SceneLine[]): { number: number; suffix?: string; rest: SceneLine[] } | null {
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
// run of 3+ short phrases reads as a tag/feature list, a single medium line reads as statement
// auto-fit, and only very short lines read as full-bleed poster — longer beats default to plain
// or other varied treatments.
export function getSceneStyleCandidates(kicker: string | null | undefined, lines: SceneLine[]): SceneStyle[] {
  if (extractBigNumber(lines)) return ['bignumber'];

  const candidates: SceneStyle[] = [];
  const totalWords = (kicker ? wordCount(kicker) : 0) + lines.reduce((n, l) => n + wordCount(l.text), 0);
  const lineWordCounts = lines.map((l) => wordCount(l.text));

  if (lines.length >= 3 && lineWordCounts.every((n) => n <= 3)) {
    candidates.push('chips');
  }

  if (lines.length === 1 && totalWords >= 9 && totalWords <= 32) {
    candidates.push('statement');
  }

  if (lines.length >= 2 && lines.length <= 6 && totalWords >= 10 && totalWords <= 50) {
    candidates.push('uniform');
  }

  if (lines.length >= 2 && totalWords >= 14) {
    candidates.push('typewriter');
    candidates.push('falling');
  }

  if (lines.length >= 3 && totalWords >= 8 && totalWords <= 36) {
    candidates.push('mosaic');
  }

  if (lines.some((l) => l.accent) && lines.length <= 3 && totalWords <= 14) {
    candidates.push('badge');
  }

  // Full-bleed poster: only very short punch lines — not typical 2-line transcript beats.
  if (lines.length === 1 && totalWords <= 6) {
    candidates.push('poster');
  } else if (lines.length === 2 && totalWords <= 5 && lineWordCounts.every((n) => n <= 3)) {
    candidates.push('poster');
  }

  candidates.push('plain');

  return [...new Set(candidates)];
}

export function pickSceneStyle(kicker: string | null | undefined, lines: SceneLine[]): SceneStyle {
  return getSceneStyleCandidates(kicker, lines)[0];
}

const VARIETY_FALLBACK_STYLES: SceneStyle[] = [
  'plain',
  'uniform',
  'statement',
  'typewriter',
  'falling',
  'mosaic',
  'chips',
  'badge',
  'poster',
];

/** Hard caps for styles that read repetitive when overused (share of timeline). */
const STYLE_MAX_SHARE: Partial<Record<SceneStyle, number>> = {
  poster: 0.1,
  badge: 0.22,
};

/** Assign styles to a sequence of scenes — content-first, but limits repeats in a row and overall. */
export function assignSceneStylesWithVariety(
  scenes: { kicker?: string | null; lines: SceneLine[] }[],
  opts: { maxConsecutive?: number; maxShare?: number } = {}
): SceneStyle[] {
  const maxConsecutive = opts.maxConsecutive ?? 2;
  const maxShare = opts.maxShare ?? 0.38;
  const n = scenes.length;
  if (n === 0) return [];

  const maxForStyle = (style: SceneStyle) => {
    const share = STYLE_MAX_SHARE[style] ?? maxShare;
    return Math.max(1, Math.ceil(n * share));
  };
  const counts: Partial<Record<SceneStyle, number>> = {};
  const assigned: SceneStyle[] = [];

  const consecutiveRun = (style: SceneStyle, index: number) => {
    let run = 0;
    for (let j = index - 1; j >= 0 && assigned[j] === style; j--) run++;
    return run;
  };

  const tryPick = (style: SceneStyle, index: number) => {
    if ((counts[style] ?? 0) >= maxForStyle(style)) return false;
    if (consecutiveRun(style, index) >= maxConsecutive) return false;
    return true;
  };

  for (let i = 0; i < n; i++) {
    const candidates = getSceneStyleCandidates(scenes[i].kicker, scenes[i].lines);
    let style: SceneStyle | null = null;

    for (const c of candidates) {
      if (tryPick(c, i)) {
        style = c;
        break;
      }
    }

    if (!style) {
      const fallbackPool = [...new Set([...candidates, ...VARIETY_FALLBACK_STYLES])];
      fallbackPool.sort((a, b) => {
        const streakA = consecutiveRun(a, i);
        const streakB = consecutiveRun(b, i);
        if (streakA !== streakB) return streakA - streakB;
        return (counts[a] ?? 0) - (counts[b] ?? 0);
      });
      style = fallbackPool.find((s) => tryPick(s, i)) ?? fallbackPool[0] ?? 'plain';
    }

    assigned.push(style);
    counts[style] = (counts[style] ?? 0) + 1;
  }

  return assigned;
}

export function scenePatchForStyle(
  scene: { lines: SceneLine[]; style?: SceneStyle; number?: number; numberSuffix?: string; dark?: boolean },
  style: SceneStyle
): Pick<Scene, 'style' | 'lines' | 'number' | 'numberSuffix' | 'dark'> {
  const big = style === 'bignumber' ? extractBigNumber(scene.lines) : null;
  const lines = big ? big.rest : scene.lines;
  return {
    style,
    lines,
    number: big ? big.number : style === 'bignumber' ? scene.number : undefined,
    numberSuffix: big ? big.suffix : style === 'bignumber' ? scene.numberSuffix : undefined,
    dark: style === 'poster' ? true : scene.dark,
  };
}

function toScene(name: string, kicker: string | null | undefined, lines: SceneLine[], style?: SceneStyle): Scene {
  const resolvedStyle = style ?? pickSceneStyle(kicker, lines);
  const patch = scenePatchForStyle({ lines, dark: resolvedStyle === 'poster' }, resolvedStyle);
  return createScene({
    name,
    style: patch.style,
    lines: patch.lines,
    kicker: kicker || undefined,
    durationSec: estimateDuration(kicker, patch.lines),
    number: patch.number,
    numberSuffix: patch.numberSuffix,
    dark: patch.dark,
  });
}

// Entry point for the "paste your script" box: blank lines split scenes, "### Name" headers
// are an optional way to name a scene explicitly, "^ " marks a kicker line, "> " marks an
// accent line, and everything else is a plain line.
export function parseScript(text: string): Scene[] {
  if (!text || !text.trim()) return [];
  const blocks = parseStructuredScript(text);
  const styles = assignSceneStylesWithVariety(blocks.map((b) => ({ kicker: b.kicker, lines: b.lines })));
  return blocks.map((b, i) => toScene(b.name, b.kicker, b.lines, styles[i]));
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

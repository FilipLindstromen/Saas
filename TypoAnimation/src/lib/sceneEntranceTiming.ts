import type { ProjectTheme, Scene } from '@/types/project';
import { tokenizeInlineHighlightWords } from '@/lib/inlineHighlight';
import { stripInlineHighlightMarkup } from '@/lib/inlineHighlight';
import { alignWordTimingsToScene } from '@/remotion/shared/wordTiming';
import { sceneFrames } from '@/remotion/Composition';

/** Matches SceneTransition TRANS_DUR */
const SCENE_TRANS_DUR = 0.28;
const LINE_IN_DUR = 0.26;
const WORD_STAGGER = 0.055;
const TYPEWRITER_CHAR_SEC = 0.045;

function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

function lineEntranceEndSec(
  lineStart: number,
  text: string,
  opts: { inDur?: number; stagger?: number; wordStartsSec?: number[] | null } = {}
): number {
  const inDur = opts.inDur ?? LINE_IN_DUR;
  const stagger = opts.stagger ?? WORD_STAGGER;
  const words = tokenizeInlineHighlightWords(text);
  if (words.length === 0) return lineStart + inDur;
  if (opts.wordStartsSec?.length) {
    let max = lineStart;
    for (let i = 0; i < words.length; i++) {
      const ws = opts.wordStartsSec[i];
      if (ws != null) max = Math.max(max, ws + inDur);
    }
    return max;
  }
  const lastWordStart = lineStart + (words.length - 1) * stagger;
  return lastWordStart + inDur;
}

function enterEndSec(start: number, inDur = LINE_IN_DUR): number {
  return start + inDur;
}

function fallingLineLayout(lines: { text: string }[], dur: number) {
  const weights = lines.map((l) => Math.max(1, wordCount(l.text)));
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
  let cursor = 0;
  return lines.map((_, i) => {
    const segDur = (dur * weights[i]) / totalWeight;
    const fallDur = Math.min(0.45, segDur * 0.28);
    const start = cursor;
    cursor += segDur;
    return { start, fallDur };
  });
}

function typewriterLayout(lines: { text: string }[], dur: number) {
  const weights = lines.map((l) => Math.max(1, stripInlineHighlightMarkup(l.text).length));
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
  let cursor = 0;
  return lines.map((l, i) => {
    const plain = stripInlineHighlightMarkup(l.text);
    const segDur = (dur * weights[i]) / totalWeight;
    const typeDur = Math.min(segDur, plain.length * TYPEWRITER_CHAR_SEC);
    const start = cursor;
    cursor += segDur;
    return { start, typeDur };
  });
}

function mosaicWords(scene: Scene) {
  const out: string[] = [];
  for (const ln of scene.lines) {
    for (const w of tokenizeInlineHighlightWords(ln.text)) {
      out.push(w.word);
    }
  }
  return out;
}

/**
 * Scene-local time (seconds) when all entrance / reveal animations have finished —
 * used by Present mode and preview scene seeks so playback doesn't pause mid-stagger.
 */
export function sceneEntranceCompleteSec(
  scene: Scene,
  durSec: number,
  transition?: ProjectTheme['transition']
): number {
  let end = 0;
  const bump = (t: number) => {
    end = Math.max(end, t);
  };

  const aligned = alignWordTimingsToScene(scene);
  const dur = Math.max(0.01, durSec);

  switch (scene.style) {
    case 'plain': {
      const kickerDelay = scene.kicker ? 0.12 : 0;
      if (scene.kicker) {
        bump(lineEntranceEndSec(0, scene.kicker, { wordStartsSec: aligned?.kickerStarts }));
      }
      scene.lines.forEach((ln, i) =>
        bump(
          lineEntranceEndSec(kickerDelay + i * 0.12, ln.text, {
            wordStartsSec: aligned?.lineStarts[i],
          })
        )
      );
      break;
    }
    case 'poster': {
      const lineStart = 0.05;
      if (scene.kicker) bump(lineEntranceEndSec(0, scene.kicker));
      scene.lines.forEach((ln, i) => bump(lineEntranceEndSec(lineStart + i * 0.22, ln.text)));
      break;
    }
    case 'statement': {
      const lineStart = 0.05;
      if (scene.kicker) bump(lineEntranceEndSec(0, scene.kicker));
      scene.lines.forEach((ln, i) => bump(lineEntranceEndSec(lineStart + i * 0.16, ln.text)));
      break;
    }
    case 'uniform': {
      if (scene.kicker) bump(lineEntranceEndSec(0, scene.kicker));
      scene.lines.forEach((ln, i) => bump(lineEntranceEndSec(0.06 + i * 0.14, ln.text)));
      break;
    }
    case 'chips': {
      if (scene.kicker) bump(lineEntranceEndSec(0, scene.kicker));
      scene.lines.forEach((ln, i) => {
        const start = 0.25 + i * 0.22;
        bump(enterEndSec(start));
        bump(lineEntranceEndSec(start, ln.text));
      });
      break;
    }
    case 'badge': {
      if (scene.kicker) bump(lineEntranceEndSec(0.05, scene.kicker));
      scene.lines.forEach((ln, i) => {
        const start = 0.28 + i * 0.18;
        bump(enterEndSec(start, 0.28));
        bump(lineEntranceEndSec(start, ln.text, { inDur: 0.26 }));
      });
      break;
    }
    case 'mosaic': {
      const words = mosaicWords(scene);
      words.forEach((_, i) => bump(enterEndSec(0.05 + i * 0.045, 0.22)));
      break;
    }
    case 'bignumber': {
      bump(enterEndSec(0));
      if (scene.kicker) bump(lineEntranceEndSec(0.1, scene.kicker));
      scene.lines.forEach((ln, i) => bump(lineEntranceEndSec(0.5 + i * 0.12, ln.text)));
      break;
    }
    case 'videotext': {
      const lineStart = 0.08;
      if (scene.kicker) bump(lineEntranceEndSec(0, scene.kicker));
      scene.lines.forEach((_, i) => bump(enterEndSec(lineStart + i * 0.2, 0.32)));
      break;
    }
    case 'compare': {
      if (scene.kicker) bump(lineEntranceEndSec(0, scene.kicker));
      const rows = scene.compareRows || [];
      rows.forEach((_, i) => bump(0.9 + i * 0.5));
      break;
    }
    case 'falling': {
      if (scene.kicker) bump(lineEntranceEndSec(0, scene.kicker));
      fallingLineLayout(scene.lines, dur).forEach(({ start, fallDur }) =>
        bump(start + fallDur)
      );
      break;
    }
    case 'rotate': {
      if (scene.kicker) bump(lineEntranceEndSec(0, scene.kicker));
      scene.lines.forEach((ln, i) => bump(lineEntranceEndSec(0.05 + i * 0.1, ln.text)));
      const words =
        scene.rotatingWords && scene.rotatingWords.length ? scene.rotatingWords : [''];
      const slotDur = dur / Math.max(1, words.length);
      const transDur = Math.min(0.3, slotDur * 0.35);
      bump(transDur);
      break;
    }
    case 'typewriter': {
      typewriterLayout(scene.lines, dur).forEach(({ start, typeDur }) => bump(start + typeDur));
      break;
    }
  }

  if (transition && transition !== 'cut') {
    bump(Math.min(SCENE_TRANS_DUR, dur / 2));
  }

  return Math.min(end, dur);
}

export function presentSettleFrames(
  scene: Scene,
  fps: number,
  transition?: ProjectTheme['transition']
): number {
  const frames = sceneFrames(scene, fps);
  if (frames <= 1) return 0;
  const sec = sceneEntranceCompleteSec(scene, scene.durationSec, transition);
  const settle = Math.ceil(sec * fps);
  return Math.min(Math.max(0, settle), frames - 1);
}

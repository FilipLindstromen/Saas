import { headlinePartsForScene } from './headlines';
import {
  presentStyledPartsForScene,
  presentStyleSpansForScene,
  resolveSceneLayout,
} from './presentStyles';
import { rotateSpansForScene, bulletSpansForScene, getLineRevealStepCount } from './lineReveal';

/** Split text into sentences (by . ! ? followed by space or end). */
export function getSentences(text) {
  if (!text || !String(text).trim()) return [];
  const trimmed = String(text).trim();
  return trimmed
    .split(/(?<=[.!?])[\s\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Locate a normalized sentence in raw editor text, treating spaces and line breaks as equivalent.
 */
function findRawSentenceSpan(raw, normalizedSentence, fromIndex) {
  const words = normalizedSentence.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const pattern = words.map(escapeRegex).join('[\\s\\n]+');
  const re = new RegExp(pattern, 'g');
  re.lastIndex = Math.max(0, fromIndex);
  const match = re.exec(raw);
  if (!match) return null;
  return {
    start: match.index,
    end: match.index + match[0].length,
    text: match[0],
  };
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

/** Return segments of raw content for highlight layer: [{ start, end, text, hasImage }, ...]. */
export function getSentenceSegments(content, sentenceImages = []) {
  const raw = String(content ?? '');
  const { sentences, starts } = getSentenceStarts(content);
  if (!sentences.length) return [];

  const segments = [];
  let cursor = 0;

  for (let i = 0; i < sentences.length; i++) {
    const span = findRawSentenceSpan(raw, sentences[i], cursor);
    if (!span) {
      const normStart = starts[i] ?? 0;
      const normEnd = normStart + sentences[i].length;
      const rawStart = normalizedOffsetToRawOffset(content, normStart);
      const rawEnd = normalizedOffsetToRawOffset(content, normEnd);
      segments.push({
        start: rawStart,
        end: rawEnd,
        text: raw.slice(rawStart, rawEnd),
        hasImage: Boolean(sentenceImages[i]),
      });
      cursor = rawEnd;
      continue;
    }
    segments.push({
      start: span.start,
      end: span.end,
      text: span.text,
      hasImage: Boolean(sentenceImages[i]),
    });
    cursor = span.end;
    while (cursor < raw.length && /[\s\n]/.test(raw[cursor])) cursor += 1;
  }

  return segments;
}

/** Segments for edit highlight — same boundaries as present mode. */
export function getSentenceHighlightSegments(content, sentenceImages = []) {
  return getSentenceSegments(content, sentenceImages).map(({ start, end, hasImage }) => ({
    start,
    end,
    hasImage,
  }));
}

const PRESENT_SCENE_BREAK = /\n[\t ]*\n+/g;

/**
 * Present-mode scenes: blocks separated by a blank line (double line break).
 * Preserves single line breaks inside each scene as authored in the editor.
 */
export function getPresentScenes(content, sentenceImages = [], headlineSpans = [], rotateLineSpans = [], bulletLineSpans = [], presentStyleSpans = []) {
  const raw = String(content ?? '');
  if (!raw.trim()) return [];

  const images = Array.isArray(sentenceImages) ? sentenceImages : [];
  const segments = getSentenceSegments(content, images);
  const scenes = [];
  let chunkStart = 0;
  let match;

  const pushScene = (rawStart, rawEnd) => {
    const text = raw.slice(rawStart, rawEnd).replace(/^\s+|\s+$/g, '');
    if (!text) return;

    const sentenceIndices = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.end > rawStart && seg.start < rawEnd) sentenceIndices.push(i);
    }
    const primarySentenceIndex = sentenceIndices[0] ?? 0;
    let imageUrl = '';
    for (const i of sentenceIndices) {
      const img = images[i];
      if (img != null && String(img).trim()) {
        imageUrl = String(img).trim();
        break;
      }
    }

    const rotateSpans = rotateSpansForScene(raw, rawStart, rawEnd, text, rotateLineSpans);
    const bulletSpans = bulletSpansForScene(raw, rawStart, rawEnd, text, bulletLineSpans);
    const localStyles = presentStyleSpansForScene(raw, rawStart, rawEnd, text, presentStyleSpans);
    scenes.push({
      text,
      start: rawStart,
      end: rawEnd,
      sentenceIndices,
      primarySentenceIndex,
      imageUrl,
      styledParts: presentStyledPartsForScene(raw, rawStart, rawEnd, text, headlineSpans, presentStyleSpans),
      layout: resolveSceneLayout(localStyles),
      rotateSpans,
      bulletSpans,
      lineRevealStepCount: getLineRevealStepCount(text, rotateSpans, bulletSpans),
      rotateStepCount: getLineRevealStepCount(text, rotateSpans, bulletSpans),
    });
  };

  PRESENT_SCENE_BREAK.lastIndex = 0;
  while ((match = PRESENT_SCENE_BREAK.exec(raw)) !== null) {
    pushScene(chunkStart, match.index);
    chunkStart = match.index + match[0].length;
  }
  pushScene(chunkStart, raw.length);

  return scenes;
}

/** Flat list of present screens across all sections (in story order). */
export function buildPresentSceneList(sectionOrder, sectionsData) {
  const out = [];
  for (const sectionId of sectionOrder) {
    const section = sectionsData[sectionId];
    const content = section?.content ?? '';
    const sentenceImages = section?.sentenceImages ?? [];
    const headlineSpans = section?.headlineSpans ?? [];
    const rotateLineSpans = section?.rotateLineSpans ?? [];
    const bulletLineSpans = section?.bulletLineSpans ?? [];
    const presentStyleSpans = section?.presentStyleSpans ?? [];
    const scenes = getPresentScenes(content, sentenceImages, headlineSpans, rotateLineSpans, bulletLineSpans, presentStyleSpans);
    for (const scene of scenes) {
      out.push({
        text: scene.text,
        sectionId,
        sentenceIndexInSection: scene.primarySentenceIndex,
        sentenceIndices: scene.sentenceIndices,
        imageUrl: scene.imageUrl,
        styledParts: scene.styledParts,
        layout: scene.layout,
        rotateSpans: scene.rotateSpans,
        bulletSpans: scene.bulletSpans,
        lineRevealStepCount: scene.lineRevealStepCount,
        rotateStepCount: scene.rotateStepCount,
        sceneStart: scene.start,
        sceneEnd: scene.end,
      });
    }
  }
  return out;
}

/** Map a sentence index in a section to the global present-scene index. */
export function getGlobalSceneIndexForSentence(sectionOrder, sectionsData, sectionId, sentenceIndexInSection) {
  let global = 0;
  for (const sid of sectionOrder) {
    const section = sectionsData[sid];
    const scenes = getPresentScenes(section?.content ?? '', section?.sentenceImages ?? []);
    if (sid === sectionId) {
      const sceneIdx = scenes.findIndex((sc) => sc.sentenceIndices.includes(sentenceIndexInSection));
      return global + (sceneIdx >= 0 ? sceneIdx : 0);
    }
    global += scenes.length;
  }
  return global;
}

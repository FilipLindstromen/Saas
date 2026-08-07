import { headlinePartsForScene } from './headlines';
import {
  presentStyledPartsForScene,
  presentStyleSpansForScene,
  resolveSceneLayout,
  resolveSceneDarkText,
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

const PRESENT_SCENE_BREAK = /\n[\t ]*\n+/g;

function parseImageArgs(secondArg, thirdArg) {
  if (Array.isArray(secondArg)) {
    return { presentSceneImages: {}, sentenceImages: secondArg };
  }
  if (secondArg && typeof secondArg === 'object') {
    return {
      presentSceneImages: secondArg.presentSceneImages ?? {},
      sentenceImages: secondArg.sentenceImages ?? [],
    };
  }
  return { presentSceneImages: {}, sentenceImages: [] };
}

export function resolveSceneImageUrl(sceneStart, presentSceneImages, legacySentenceImages, sentenceIndices) {
  const key = String(sceneStart);
  const fromScene = presentSceneImages?.[key];
  if (fromScene != null && String(fromScene).trim()) {
    return String(fromScene).trim();
  }
  const images = Array.isArray(legacySentenceImages) ? legacySentenceImages : [];
  for (const i of sentenceIndices ?? []) {
    const url = images[i];
    if (url != null && String(url).trim()) return String(url).trim();
  }
  return '';
}

export function getSceneStartForSentenceIndex(content, sentenceIndex) {
  const scenes = getPresentScenes(content);
  const hit = scenes.find((sc) => sc.sentenceIndices.includes(sentenceIndex));
  return hit != null ? hit.start : null;
}

/** Raw sentence spans in editor text (no image flags — safe to call from getPresentScenes). */
function buildRawSentenceSegments(content) {
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
      });
      cursor = rawEnd;
      continue;
    }
    segments.push({
      start: span.start,
      end: span.end,
      text: span.text,
    });
    cursor = span.end;
    while (cursor < raw.length && /[\s\n]/.test(raw[cursor])) cursor += 1;
  }

  return segments;
}

/** Present screens (blank-line blocks) with sentence indices — no styling/image side effects. */
function enumeratePresentSceneChunks(content, segments) {
  const raw = String(content ?? '');
  if (!raw.trim()) return [];

  const chunks = [];
  let chunkStart = 0;
  let match;

  const pushChunk = (rawStart, rawEnd) => {
    const text = raw.slice(rawStart, rawEnd).replace(/^\s+|\s+$/g, '');
    if (!text) return;

    const sentenceIndices = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.end > rawStart && seg.start < rawEnd) sentenceIndices.push(i);
    }
    chunks.push({ start: rawStart, end: rawEnd, text, sentenceIndices });
  };

  PRESENT_SCENE_BREAK.lastIndex = 0;
  while ((match = PRESENT_SCENE_BREAK.exec(raw)) !== null) {
    pushChunk(chunkStart, match.index);
    chunkStart = match.index + match[0].length;
  }
  pushChunk(chunkStart, raw.length);

  return chunks;
}

/** Return segments of raw content for highlight layer: [{ start, end, text, hasImage }, ...]. */
export function getSentenceSegments(content, legacySentenceImages = [], presentSceneImages = {}) {
  const base = buildRawSentenceSegments(content);
  if (!base.length) return [];

  const chunks = enumeratePresentSceneChunks(content, base);
  const sentenceHasSceneImage = new Set();
  for (const ch of chunks) {
    const url = resolveSceneImageUrl(
      ch.start,
      presentSceneImages,
      legacySentenceImages,
      ch.sentenceIndices
    );
    if (!url) continue;
    for (const i of ch.sentenceIndices) sentenceHasSceneImage.add(i);
  }

  return base.map((seg, i) => ({
    ...seg,
    hasImage: sentenceHasSceneImage.has(i),
  }));
}

/** Segments for edit highlight — same boundaries as present mode. */
export function getSentenceHighlightSegments(content, legacySentenceImages = [], presentSceneImages = {}) {
  return getSentenceSegments(content, legacySentenceImages, presentSceneImages).map(({ start, end, hasImage }) => ({
    start,
    end,
    hasImage,
  }));
}

/**
 * Present-mode scenes: blocks separated by a blank line (double line break).
 * Preserves single line breaks inside each scene as authored in the editor.
 */
export function getPresentScenes(
  content,
  imageArg = {},
  headlineSpans = [],
  rotateLineSpans = [],
  bulletLineSpans = [],
  presentStyleSpans = []
) {
  const raw = String(content ?? '');
  if (!raw.trim()) return [];

  const { presentSceneImages, sentenceImages } = parseImageArgs(imageArg);
  const segments = buildRawSentenceSegments(content);
  const scenes = [];
  const chunks = enumeratePresentSceneChunks(raw, segments);

  for (const ch of chunks) {
    const { start: rawStart, end: rawEnd, text, sentenceIndices } = ch;
    const primarySentenceIndex = sentenceIndices[0] ?? 0;
    const imageUrl = resolveSceneImageUrl(
      rawStart,
      presentSceneImages,
      sentenceImages,
      sentenceIndices
    );

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
      darkText: resolveSceneDarkText(localStyles),
      styledParts: presentStyledPartsForScene(raw, rawStart, rawEnd, text, headlineSpans, presentStyleSpans),
      layout: resolveSceneLayout(localStyles),
      rotateSpans,
      bulletSpans,
      lineRevealStepCount: getLineRevealStepCount(text, rotateSpans, bulletSpans),
      rotateStepCount: getLineRevealStepCount(text, rotateSpans, bulletSpans),
    });
  }

  return scenes;
}

/** Flat list of present screens across all sections (in story order). */
export function buildPresentSceneList(sectionOrder, sectionsData) {
  const out = [];
  for (const sectionId of sectionOrder) {
    const section = sectionsData[sectionId];
    const content = section?.content ?? '';
    const presentSceneImages = section?.presentSceneImages ?? {};
    const sentenceImages = section?.sentenceImages ?? [];
    const headlineSpans = section?.headlineSpans ?? [];
    const rotateLineSpans = section?.rotateLineSpans ?? [];
    const bulletLineSpans = section?.bulletLineSpans ?? [];
    const presentStyleSpans = section?.presentStyleSpans ?? [];
    const scenes = getPresentScenes(
      content,
      { presentSceneImages, sentenceImages },
      headlineSpans,
      rotateLineSpans,
      bulletLineSpans,
      presentStyleSpans
    );
    for (const scene of scenes) {
      out.push({
        text: scene.text,
        sectionId,
        sentenceIndexInSection: scene.primarySentenceIndex,
        sentenceIndices: scene.sentenceIndices,
        sceneStart: scene.start,
        imageUrl: scene.imageUrl,
        darkText: scene.darkText,
        styledParts: scene.styledParts,
        layout: scene.layout,
        rotateSpans: scene.rotateSpans,
        bulletSpans: scene.bulletSpans,
        lineRevealStepCount: scene.lineRevealStepCount,
        rotateStepCount: scene.rotateStepCount,
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
    const scenes = getPresentScenes(section?.content ?? '', {
      presentSceneImages: section?.presentSceneImages ?? {},
      sentenceImages: section?.sentenceImages ?? [],
    });
    if (sid === sectionId) {
      const sceneIdx = scenes.findIndex((sc) => sc.sentenceIndices.includes(sentenceIndexInSection));
      return global + (sceneIdx >= 0 ? sceneIdx : 0);
    }
    global += scenes.length;
  }
  return global;
}

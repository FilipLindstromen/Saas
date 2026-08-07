import { remapHeadlineSpans } from './headlines';
import { remapPresentStyleSpans } from './presentStyles';
import { remapRotateSpans, remapBulletSpans } from './lineReveal';
import {
  getSentenceStarts,
  getSectionImageHighlightRanges,
  normalizedOffsetToSentenceIndex,
  contentOffsetToNormalized,
  normalizedOffsetToRawOffset,
  buildPresentSceneList,
} from './sentences';
import {
  remapPresentSceneImages,
  remapPresentSceneImageLocks,
} from './presentSceneImages';
import { mapOldIndexToNew } from './textEditMap';

/** Invisible boundary between framework sections in the unified editor (not shown in UI). */
export const SECTION_SEPARATOR = '\n\n\u200C\n\n';
const SECTION_SPLIT_RE = /\n\n[\u001E\u200C]\n\n/;

export function normalizeUnifiedSeparators(unified) {
  return String(unified ?? '').replace(/\u001E/g, '\u200C');
}

function includedSectionCount(sectionOrder, sectionsData) {
  const parts = sectionOrder.map((id) => sectionsData[id]?.content ?? '');
  if (!parts.some((p) => String(p).trim())) return 0;
  let end = parts.length;
  while (end > 1 && !String(parts[end - 1]).trim()) {
    end -= 1;
  }
  return end;
}

export function joinSectionContents(sectionOrder, sectionsData) {
  const end = includedSectionCount(sectionOrder, sectionsData);
  if (end === 0) return '';
  const parts = sectionOrder.map((id) => sectionsData[id]?.content ?? '');
  return parts.slice(0, end).join(SECTION_SEPARATOR);
}

export function splitIntoSectionContents(unified, sectionOrder) {
  const normalized = normalizeUnifiedSeparators(unified);
  const parts = normalized.split(SECTION_SPLIT_RE);
  const result = {};
  for (let i = 0; i < sectionOrder.length; i++) {
    result[sectionOrder[i]] = parts[i] ?? '';
  }
  if (parts.length > sectionOrder.length && sectionOrder.length > 0) {
    const lastId = sectionOrder[sectionOrder.length - 1];
    result[lastId] = parts.slice(sectionOrder.length - 1).join(SECTION_SEPARATOR);
  }
  return result;
}

function remapSentenceImages(oldContent, newContent, oldImages) {
  const old = String(oldContent ?? '');
  const next = String(newContent ?? '');
  const { starts: oldStarts } = getSentenceStarts(old);
  const { sentences: newS, starts: newStarts } = getSentenceStarts(next);
  if (!newS.length) return [];
  const images = Array.isArray(oldImages) ? oldImages : [];
  const result = newS.map(() => '');

  for (let i = 0; i < oldStarts.length; i++) {
    const url = images[i];
    if (!url) continue;
    const rawStart = normalizedOffsetToRawOffset(old, oldStarts[i]);
    const mappedRaw = mapOldIndexToNew(old, next, rawStart);
    const normMapped = contentOffsetToNormalized(next, mappedRaw);
    const newIdx = normalizedOffsetToSentenceIndex(normMapped, newStarts);
    if (newIdx >= 0 && newIdx < result.length && !result[newIdx]) {
      result[newIdx] = url;
    }
  }
  return result;
}

function remapSentenceLocks(oldContent, newContent, oldLocks) {
  const old = String(oldContent ?? '');
  const next = String(newContent ?? '');
  const { starts: oldStarts } = getSentenceStarts(old);
  const { sentences: newS, starts: newStarts } = getSentenceStarts(next);
  if (!newS.length) return [];
  const locks = Array.isArray(oldLocks) ? oldLocks : [];
  const result = newS.map(() => false);

  for (let i = 0; i < oldStarts.length; i++) {
    if (!locks[i]) continue;
    const rawStart = normalizedOffsetToRawOffset(old, oldStarts[i]);
    const mappedRaw = mapOldIndexToNew(old, next, rawStart);
    const normMapped = contentOffsetToNormalized(next, mappedRaw);
    const newIdx = normalizedOffsetToSentenceIndex(normMapped, newStarts);
    if (newIdx >= 0 && newIdx < result.length) {
      result[newIdx] = true;
    }
  }
  return result;
}

export function applyUnifiedStoryEdit(sectionOrder, sectionsData, unified) {
  const cleaned = normalizeUnifiedSeparators(unified).replace(/(\n\n\u200C\n\n)+$/g, '');
  const split = splitIntoSectionContents(cleaned, sectionOrder);
  const next = { ...sectionsData };
  for (const id of sectionOrder) {
    const old = sectionsData[id] ?? {};
    const newContent = split[id] ?? '';
    next[id] = {
      ...old,
      content: newContent,
      sentenceImages: remapSentenceImages(old.content ?? '', newContent, old.sentenceImages ?? []),
      sentenceImageLocks: remapSentenceLocks(old.content ?? '', newContent, old.sentenceImageLocks ?? []),
      presentSceneImages: remapPresentSceneImages(
        old.content ?? '',
        newContent,
        old.presentSceneImages ?? {},
        old.sentenceImages ?? []
      ),
      presentSceneImageLocks: remapPresentSceneImageLocks(
        old.content ?? '',
        newContent,
        old.presentSceneImageLocks ?? {},
        old.presentSceneImages ?? {},
        old.sentenceImages ?? []
      ),
      headlineSpans: remapHeadlineSpans(old.content ?? '', newContent, old.headlineSpans ?? []),
      presentStyleSpans: remapPresentStyleSpans(old.content ?? '', newContent, old.presentStyleSpans ?? []),
      rotateLineSpans: remapRotateSpans(old.content ?? '', newContent, old.rotateLineSpans ?? []),
      bulletLineSpans: remapBulletSpans(old.content ?? '', newContent, old.bulletLineSpans ?? []),
    };
  }
  return next;
}

export function getUnifiedSectionSpans(sectionOrder, sectionsData) {
  const spans = [];
  const end = includedSectionCount(sectionOrder, sectionsData);
  let pos = 0;
  for (let i = 0; i < end; i++) {
    const id = sectionOrder[i];
    const content = sectionsData[id]?.content ?? '';
    spans.push({ sectionId: id, start: pos, end: pos + content.length });
    pos += content.length;
    if (i < end - 1) pos += SECTION_SEPARATOR.length;
  }
  return spans;
}

export function locateCursorInStory(sectionOrder, sectionsData, unifiedOffset) {
  const spans = getUnifiedSectionSpans(sectionOrder, sectionsData);
  for (const span of spans) {
    if (unifiedOffset >= span.start && unifiedOffset <= span.end) {
      return { sectionId: span.sectionId, localOffset: unifiedOffset - span.start };
    }
  }
  const last = spans[spans.length - 1];
  if (last) {
    return { sectionId: last.sectionId, localOffset: Math.max(0, last.end - last.start) };
  }
  return null;
}

export function locateSentenceAtUnifiedOffset(sectionOrder, sectionsData, unifiedOffset) {
  const located = locateCursorInStory(sectionOrder, sectionsData, unifiedOffset);
  if (!located) return null;
  const content = sectionsData[located.sectionId]?.content ?? '';
  const { starts } = getSentenceStarts(content);
  const norm = contentOffsetToNormalized(content, located.localOffset);
  const sentenceIndex = normalizedOffsetToSentenceIndex(norm, starts);
  return { sectionId: located.sectionId, sentenceIndex };
}

/** Selection range within a single section, or null if invalid / cross-section. */
export function unifiedSelectionToSectionRange(sectionOrder, sectionsData, selStart, selEnd) {
  const a = locateCursorInStory(sectionOrder, sectionsData, selStart);
  const b = locateCursorInStory(sectionOrder, sectionsData, selEnd);
  if (!a || !b || a.sectionId !== b.sectionId) return null;
  const lo = Math.min(a.localOffset, b.localOffset);
  const hi = Math.max(a.localOffset, b.localOffset);
  if (hi <= lo) return null;
  return { sectionId: a.sectionId, start: lo, end: hi };
}

/** Unified editor offset for a global present-scene index (start of that slide's text). */
export function unifiedOffsetForPresentSceneIndex(sectionOrder, sectionsData, globalIndex) {
  const scenes = buildPresentSceneList(sectionOrder, sectionsData);
  const idx = Math.max(0, Math.min(globalIndex, Math.max(0, scenes.length - 1)));
  const scene = scenes[idx];
  if (!scene) return 0;
  const spans = getUnifiedSectionSpans(sectionOrder, sectionsData);
  const span = spans.find((s) => s.sectionId === scene.sectionId);
  if (!span) return 0;
  const sectionContent = sectionsData[scene.sectionId]?.content ?? '';
  const sceneStart = Number(scene.sceneStart);
  const startInSection = Number.isFinite(sceneStart) ? sceneStart : 0;
  const clamped = Math.max(0, Math.min(startInSection, sectionContent.length));
  return span.start + clamped;
}

export function buildUnifiedHighlightParts(sectionOrder, sectionsData) {
  const unified = joinSectionContents(sectionOrder, sectionsData);
  const parts = [];
  let unifiedCursor = 0;
  const end = includedSectionCount(sectionOrder, sectionsData);

  for (let i = 0; i < end; i++) {
    const id = sectionOrder[i];
    const content = sectionsData[id]?.content ?? '';
    const images = sectionsData[id]?.sentenceImages ?? [];
    const presentSceneImages = sectionsData[id]?.presentSceneImages ?? {};
    const imageRanges = getSectionImageHighlightRanges(content, images, presentSceneImages);
    const spanStart = unifiedCursor;
    const boundaries = new Set([0, content.length]);
    for (const r of imageRanges) {
      boundaries.add(r.start);
      boundaries.add(r.end);
    }
    const points = [...boundaries].sort((a, b) => a - b);
    for (let p = 0; p < points.length - 1; p++) {
      const ls = points[p];
      const le = points[p + 1];
      if (le <= ls) continue;
      const highlight = imageRanges.some((r) => r.start <= ls && r.end >= le);
      parts.push({
        text: unified.slice(spanStart + ls, spanStart + le),
        highlight,
      });
    }
    unifiedCursor = spanStart + content.length;
    if (i < end - 1) {
      const sepStart = unifiedCursor;
      unifiedCursor += SECTION_SEPARATOR.length;
      parts.push({ text: unified.slice(sepStart, unifiedCursor), highlight: false });
    }
  }

  return parts.length ? parts : [{ text: unified, highlight: false }];
}

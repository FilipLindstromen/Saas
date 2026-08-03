import { remapHeadlineSpans } from './headlines';
import { remapRotateSpans, remapBulletSpans } from './lineReveal';
import {
  getSentenceStarts,
  getSentenceSegments,
  normalizedOffsetToSentenceIndex,
  contentOffsetToNormalized,
} from './sentences';

/** Invisible boundary between framework sections in the unified editor (not shown in UI). */
export const SECTION_SEPARATOR = '\n\n\u001E\n\n';

export function joinSectionContents(sectionOrder, sectionsData) {
  const parts = sectionOrder.map((id) => sectionsData[id]?.content ?? '');
  if (!parts.some((p) => String(p).trim())) return '';
  return parts.join(SECTION_SEPARATOR);
}

export function splitIntoSectionContents(unified, sectionOrder) {
  const parts = String(unified ?? '').split(SECTION_SEPARATOR);
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
  const { sentences: oldS } = getSentenceStarts(oldContent);
  const { sentences: newS } = getSentenceStarts(newContent);
  if (!newS.length) return [];
  const images = Array.isArray(oldImages) ? oldImages : [];
  return newS.map((sentence) => {
    const oldIdx = oldS.indexOf(sentence);
    return oldIdx >= 0 && images[oldIdx] ? images[oldIdx] : '';
  });
}

export function applyUnifiedStoryEdit(sectionOrder, sectionsData, unified) {
  const split = splitIntoSectionContents(unified, sectionOrder);
  const next = { ...sectionsData };
  for (const id of sectionOrder) {
    const old = sectionsData[id] ?? {};
    const newContent = split[id] ?? '';
    next[id] = {
      ...old,
      content: newContent,
      sentenceImages: remapSentenceImages(old.content ?? '', newContent, old.sentenceImages ?? []),
      headlineSpans: remapHeadlineSpans(old.content ?? '', newContent, old.headlineSpans ?? []),
      rotateLineSpans: remapRotateSpans(old.content ?? '', newContent, old.rotateLineSpans ?? []),
      bulletLineSpans: remapBulletSpans(old.content ?? '', newContent, old.bulletLineSpans ?? []),
    };
  }
  return next;
}

export function getUnifiedSectionSpans(sectionOrder, sectionsData) {
  const spans = [];
  let pos = 0;
  for (let i = 0; i < sectionOrder.length; i++) {
    const id = sectionOrder[i];
    const content = sectionsData[id]?.content ?? '';
    spans.push({ sectionId: id, start: pos, end: pos + content.length });
    pos += content.length;
    if (i < sectionOrder.length - 1) pos += SECTION_SEPARATOR.length;
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

export function buildUnifiedHighlightParts(sectionOrder, sectionsData) {
  const unified = joinSectionContents(sectionOrder, sectionsData);
  const parts = [];
  let unifiedCursor = 0;

  for (let i = 0; i < sectionOrder.length; i++) {
    const id = sectionOrder[i];
    const content = sectionsData[id]?.content ?? '';
    const images = sectionsData[id]?.sentenceImages ?? [];
    const segments = getSentenceSegments(content, images);
    const spanStart = unifiedCursor;
    let localLast = 0;

    for (const seg of segments) {
      const absStart = spanStart + seg.start;
      const absEnd = spanStart + seg.end;
      if (seg.start > localLast) {
        parts.push({ text: unified.slice(spanStart + localLast, absStart), highlight: false });
      }
      parts.push({ text: unified.slice(absStart, absEnd), highlight: seg.hasImage });
      localLast = seg.end;
    }
    if (localLast < content.length) {
      parts.push({
        text: unified.slice(spanStart + localLast, spanStart + content.length),
        highlight: false,
      });
    }
    unifiedCursor = spanStart + content.length;
    if (i < sectionOrder.length - 1) {
      const sepStart = unifiedCursor;
      unifiedCursor += SECTION_SEPARATOR.length;
      parts.push({ text: unified.slice(sepStart, unifiedCursor), highlight: false });
    }
  }

  return parts.length ? parts : [{ text: unified, highlight: false }];
}

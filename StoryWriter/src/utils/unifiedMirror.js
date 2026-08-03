import { getUnifiedSectionSpans, joinSectionContents } from './storyDocument';
import { getSentenceSegments } from './sentences';
import { normalizeHeadlineSpans } from './headlines';

export function buildUnifiedMirrorParts(sectionOrder, sectionsData) {
  const unified = joinSectionContents(sectionOrder, sectionsData);
  if (!unified) return [{ text: '', hasImage: false, headline: false, rotate: false, bullet: false }];

  const boundaries = new Set([0, unified.length]);
  const imageRanges = [];
  const headlineRanges = [];
  const rotateRanges = [];
  const bulletRanges = [];

  for (const span of getUnifiedSectionSpans(sectionOrder, sectionsData)) {
    const content = sectionsData[span.sectionId]?.content ?? '';
    const images = sectionsData[span.sectionId]?.sentenceImages ?? [];
    const headlines = sectionsData[span.sectionId]?.headlineSpans ?? [];
    const rotates = sectionsData[span.sectionId]?.rotateLineSpans ?? [];
    const bullets = sectionsData[span.sectionId]?.bulletLineSpans ?? [];

    for (const seg of getSentenceSegments(content, images)) {
      if (!seg.hasImage) continue;
      const start = span.start + seg.start;
      const end = span.start + seg.end;
      imageRanges.push({ start, end });
      boundaries.add(start);
      boundaries.add(end);
    }

    for (const h of normalizeHeadlineSpans(headlines, content.length)) {
      const start = span.start + h.start;
      const end = span.start + h.end;
      headlineRanges.push({ start, end });
      boundaries.add(start);
      boundaries.add(end);
    }

    for (const r of normalizeHeadlineSpans(rotates, content.length)) {
      const start = span.start + r.start;
      const end = span.start + r.end;
      rotateRanges.push({ start, end });
      boundaries.add(start);
      boundaries.add(end);
    }

    for (const b of normalizeHeadlineSpans(bullets, content.length)) {
      const start = span.start + b.start;
      const end = span.start + b.end;
      bulletRanges.push({ start, end });
      boundaries.add(start);
      boundaries.add(end);
    }
  }

  const points = [...boundaries].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (end <= start) continue;
    const hasImage = imageRanges.some((r) => r.start <= start && r.end >= end);
    const headline = headlineRanges.some((r) => r.start <= start && r.end >= end);
    const bullet = bulletRanges.some((r) => r.start <= start && r.end >= end);
    const rotate = !bullet && rotateRanges.some((r) => r.start <= start && r.end >= end);
    parts.push({ text: unified.slice(start, end), hasImage, headline, rotate, bullet });
  }
  return parts.length ? parts : [{ text: unified, hasImage: false, headline: false, rotate: false, bullet: false }];
}

function rangeOverlapsLine(rangeStart, rangeEnd, lineStart, lineEnd) {
  return rangeStart < lineEnd && rangeEnd > lineStart;
}

/** One row per text line (split on \\n) with style flags for the edit gutter. */
export function buildUnifiedLineGutter(sectionOrder, sectionsData) {
  const unified = joinSectionContents(sectionOrder, sectionsData);
  if (!unified) return [{ headline: false, rotate: false, bullet: false, hasImage: false }];

  const headlineRanges = [];
  const rotateRanges = [];
  const bulletRanges = [];
  const imageRanges = [];

  for (const span of getUnifiedSectionSpans(sectionOrder, sectionsData)) {
    const content = sectionsData[span.sectionId]?.content ?? '';
    const images = sectionsData[span.sectionId]?.sentenceImages ?? [];
    const headlines = sectionsData[span.sectionId]?.headlineSpans ?? [];
    const rotates = sectionsData[span.sectionId]?.rotateLineSpans ?? [];
    const bullets = sectionsData[span.sectionId]?.bulletLineSpans ?? [];

    for (const seg of getSentenceSegments(content, images)) {
      if (!seg.hasImage) continue;
      imageRanges.push({ start: span.start + seg.start, end: span.start + seg.end });
    }
    for (const h of normalizeHeadlineSpans(headlines, content.length)) {
      headlineRanges.push({ start: span.start + h.start, end: span.start + h.end });
    }
    for (const r of normalizeHeadlineSpans(rotates, content.length)) {
      rotateRanges.push({ start: span.start + r.start, end: span.start + r.end });
    }
    for (const b of normalizeHeadlineSpans(bullets, content.length)) {
      bulletRanges.push({ start: span.start + b.start, end: span.start + b.end });
    }
  }

  const lines = unified.split('\n');
  const rows = [];
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = offset;
    const lineEnd = offset + line.length;
    const headline = headlineRanges.some((r) => rangeOverlapsLine(r.start, r.end, lineStart, lineEnd));
    const bullet = bulletRanges.some((r) => rangeOverlapsLine(r.start, r.end, lineStart, lineEnd));
    const rotate =
      !bullet && rotateRanges.some((r) => rangeOverlapsLine(r.start, r.end, lineStart, lineEnd));
    const hasImage = imageRanges.some((r) => rangeOverlapsLine(r.start, r.end, lineStart, lineEnd));
    rows.push({ headline, rotate, bullet, hasImage });
    offset = lineEnd + 1;
  }
  return rows.length ? rows : [{ headline: false, rotate: false, bullet: false, hasImage: false }];
}

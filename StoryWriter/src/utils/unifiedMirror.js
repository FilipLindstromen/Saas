import { getUnifiedSectionSpans, joinSectionContents } from './storyDocument';
import { getSentenceSegments } from './sentences';
import { normalizeHeadlineSpans } from './headlines';

export function buildUnifiedMirrorParts(sectionOrder, sectionsData) {
  const unified = joinSectionContents(sectionOrder, sectionsData);
  if (!unified) return [{ text: '', hasImage: false, headline: false }];

  const boundaries = new Set([0, unified.length]);
  const imageRanges = [];
  const headlineRanges = [];

  for (const span of getUnifiedSectionSpans(sectionOrder, sectionsData)) {
    const content = sectionsData[span.sectionId]?.content ?? '';
    const images = sectionsData[span.sectionId]?.sentenceImages ?? [];
    const headlines = sectionsData[span.sectionId]?.headlineSpans ?? [];

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
  }

  const points = [...boundaries].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (end <= start) continue;
    const hasImage = imageRanges.some((r) => r.start <= start && r.end >= end);
    const headline = headlineRanges.some((r) => r.start <= start && r.end >= end);
    parts.push({ text: unified.slice(start, end), hasImage, headline });
  }
  return parts.length ? parts : [{ text: unified, hasImage: false, headline: false }];
}

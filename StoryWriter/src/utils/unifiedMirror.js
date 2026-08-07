import { getUnifiedSectionSpans, joinSectionContents } from './storyDocument';
import { getSectionImageHighlightRanges } from './sentences';
import { normalizeHeadlineSpans } from './headlines';
import { normalizePresentStyleSpans } from './presentStyles';

function styleFlagsForRange(styles, start, end) {
  const emphasis = styles.some((s) => s.style === 'emphasis' && s.start <= start && s.end >= end);
  const caption = styles.some((s) => s.style === 'caption' && s.start <= start && s.end >= end);
  const large = styles.some((s) => s.style === 'large' && s.start <= start && s.end >= end);
  const whisper = styles.some((s) => s.style === 'whisper' && s.start <= start && s.end >= end);
  const alignLeft = styles.some((s) => s.style === 'align-left' && s.start <= start && s.end >= end);
  const darkText = styles.some((s) => s.style === 'dark-text' && s.start <= start && s.end >= end);
  return { emphasis, caption, large, whisper, alignLeft, darkText };
}

export function buildUnifiedMirrorParts(sectionOrder, sectionsData) {
  const unified = joinSectionContents(sectionOrder, sectionsData);
  if (!unified) {
    return [{ text: '', hasImage: false, headline: false, rotate: false, bullet: false, emphasis: false, caption: false, large: false, whisper: false, alignLeft: false, darkText: false }];
  }

  const boundaries = new Set([0, unified.length]);
  const imageRanges = [];
  const headlineRanges = [];
  const rotateRanges = [];
  const bulletRanges = [];
  const presentStyleRanges = [];

  for (const span of getUnifiedSectionSpans(sectionOrder, sectionsData)) {
    const content = sectionsData[span.sectionId]?.content ?? '';
    const images = sectionsData[span.sectionId]?.sentenceImages ?? [];
    const presentSceneImages = sectionsData[span.sectionId]?.presentSceneImages ?? {};
    const headlines = sectionsData[span.sectionId]?.headlineSpans ?? [];
    const rotates = sectionsData[span.sectionId]?.rotateLineSpans ?? [];
    const bullets = sectionsData[span.sectionId]?.bulletLineSpans ?? [];
    const presentStyles = sectionsData[span.sectionId]?.presentStyleSpans ?? [];

    for (const r of getSectionImageHighlightRanges(content, images, presentSceneImages)) {
      const start = span.start + r.start;
      const end = span.start + r.end;
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

    for (const ps of normalizePresentStyleSpans(presentStyles, content.length)) {
      const start = span.start + ps.start;
      const end = span.start + ps.end;
      presentStyleRanges.push({ start, end, style: ps.style });
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
    const localStyles = presentStyleRanges.filter((r) => r.start <= start && r.end >= end);
    const flags = styleFlagsForRange(localStyles, start, end);
    parts.push({
      text: unified.slice(start, end),
      hasImage,
      headline,
      rotate,
      bullet,
      ...flags,
    });
  }
  return parts.length
    ? parts
    : [{ text: unified, hasImage: false, headline: false, rotate: false, bullet: false, emphasis: false, caption: false, large: false, whisper: false, alignLeft: false }];
}

function rangeOverlapsLine(rangeStart, rangeEnd, lineStart, lineEnd) {
  return rangeStart < lineEnd && rangeEnd > lineStart;
}

/** One row per text line (split on \\n) with style flags for the edit gutter. */
export function buildUnifiedLineGutter(sectionOrder, sectionsData) {
  const unified = joinSectionContents(sectionOrder, sectionsData);
  if (!unified) return [{ headline: false, rotate: false, bullet: false, hasImage: false, emphasis: false, caption: false, large: false, whisper: false, alignLeft: false }];

  const headlineRanges = [];
  const rotateRanges = [];
  const bulletRanges = [];
  const imageRanges = [];
  const presentStyleRanges = [];

  for (const span of getUnifiedSectionSpans(sectionOrder, sectionsData)) {
    const content = sectionsData[span.sectionId]?.content ?? '';
    const images = sectionsData[span.sectionId]?.sentenceImages ?? [];
    const presentSceneImages = sectionsData[span.sectionId]?.presentSceneImages ?? {};
    const headlines = sectionsData[span.sectionId]?.headlineSpans ?? [];
    const rotates = sectionsData[span.sectionId]?.rotateLineSpans ?? [];
    const bullets = sectionsData[span.sectionId]?.bulletLineSpans ?? [];
    const presentStyles = sectionsData[span.sectionId]?.presentStyleSpans ?? [];

    for (const r of getSectionImageHighlightRanges(content, images, presentSceneImages)) {
      imageRanges.push({ start: span.start + r.start, end: span.start + r.end });
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
    for (const ps of normalizePresentStyleSpans(presentStyles, content.length)) {
      presentStyleRanges.push({ start: span.start + ps.start, end: span.start + ps.end, style: ps.style });
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
    const emphasis = presentStyleRanges.some(
      (r) => r.style === 'emphasis' && rangeOverlapsLine(r.start, r.end, lineStart, lineEnd)
    );
    const caption = presentStyleRanges.some(
      (r) => r.style === 'caption' && rangeOverlapsLine(r.start, r.end, lineStart, lineEnd)
    );
    const large = presentStyleRanges.some(
      (r) => r.style === 'large' && rangeOverlapsLine(r.start, r.end, lineStart, lineEnd)
    );
    const whisper = presentStyleRanges.some(
      (r) => r.style === 'whisper' && rangeOverlapsLine(r.start, r.end, lineStart, lineEnd)
    );
    const alignLeft = presentStyleRanges.some(
      (r) => r.style === 'align-left' && rangeOverlapsLine(r.start, r.end, lineStart, lineEnd)
    );
    const darkText = presentStyleRanges.some(
      (r) => r.style === 'dark-text' && rangeOverlapsLine(r.start, r.end, lineStart, lineEnd)
    );
    rows.push({ headline, rotate, bullet, hasImage, emphasis, caption, large, whisper, alignLeft, darkText });
    offset = lineEnd + 1;
  }
  return rows.length
    ? rows
    : [{ headline: false, rotate: false, bullet: false, hasImage: false, emphasis: false, caption: false, large: false, whisper: false, alignLeft: false, darkText: false }];
}

export function buildUnifiedMirrorPartsSafe(sectionOrder, sectionsData) {
  try {
    return buildUnifiedMirrorParts(sectionOrder, sectionsData);
  } catch (err) {
    console.warn('[Edit] Mirror highlight failed:', err);
    const unified = joinSectionContents(sectionOrder, sectionsData);
    return [
      {
        text: unified,
        hasImage: false,
        headline: false,
        rotate: false,
        bullet: false,
        emphasis: false,
        caption: false,
        large: false,
        whisper: false,
        alignLeft: false,
      },
    ];
  }
}

export function buildUnifiedLineGutterSafe(sectionOrder, sectionsData) {
  try {
    return buildUnifiedLineGutter(sectionOrder, sectionsData);
  } catch (err) {
    console.warn('[Edit] Gutter hints failed:', err);
    const unified = joinSectionContents(sectionOrder, sectionsData);
    const lineCount = unified ? unified.split('\n').length : 1;
    return Array.from({ length: lineCount }, () => ({
      headline: false,
      rotate: false,
      bullet: false,
      hasImage: false,
      emphasis: false,
      caption: false,
      large: false,
      whisper: false,
      alignLeft: false,
    }));
  }
}

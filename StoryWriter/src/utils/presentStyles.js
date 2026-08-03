import { normalizeHeadlineSpans, mergeHeadlineSpans } from './headlines';

export const PRESENT_TEXT_STYLES = ['emphasis', 'caption', 'large', 'whisper'];
export const PRESENT_LAYOUT_STYLES = ['align-left', 'align-center'];

export function normalizePresentStyleSpans(spans, contentLength) {
  const len = Math.max(0, Number(contentLength) || 0);
  if (!Array.isArray(spans)) return [];
  return spans
    .map((s) => ({
      start: Math.max(0, Math.min(len, Number(s.start) || 0)),
      end: Math.max(0, Math.min(len, Number(s.end) || 0)),
      style: String(s.style ?? '').trim(),
    }))
    .filter((s) => s.end > s.start && [...PRESENT_TEXT_STYLES, ...PRESENT_LAYOUT_STYLES].includes(s.style))
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

export function mergePresentStyleSpans(spans, contentLength) {
  const normalized = normalizePresentStyleSpans(spans, contentLength);
  if (!normalized.length) return [];
  const merged = [{ ...normalized[0] }];
  for (let i = 1; i < normalized.length; i++) {
    const prev = merged[merged.length - 1];
    const cur = normalized[i];
    if (cur.start <= prev.end && cur.style === prev.style) {
      prev.end = Math.max(prev.end, cur.end);
    } else if (cur.start <= prev.end) {
      merged.push({ ...cur });
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

export function remapPresentStyleSpans(oldContent, newContent, spans) {
  const old = String(oldContent ?? '');
  const next = String(newContent ?? '');
  const out = [];
  for (const span of normalizePresentStyleSpans(spans, old.length)) {
    const snippet = old.slice(span.start, span.end);
    if (!snippet) continue;
    const idx = next.indexOf(snippet);
    if (idx < 0) continue;
    out.push({ start: idx, end: idx + snippet.length, style: span.style });
  }
  return mergePresentStyleSpans(out, next.length);
}

export function addPresentStyleSpan(spans, start, end, style, contentLength) {
  const lo = Math.max(0, Math.min(start, end));
  const hi = Math.min(contentLength, Math.max(start, end));
  if (hi <= lo) return normalizePresentStyleSpans(spans, contentLength);
  const next = [
    ...normalizePresentStyleSpans(spans, contentLength).filter((s) => {
      if (PRESENT_LAYOUT_STYLES.includes(style) && PRESENT_LAYOUT_STYLES.includes(s.style)) {
        return !(s.end > lo && s.start < hi);
      }
      return true;
    }),
    { start: lo, end: hi, style },
  ];
  return mergePresentStyleSpans(next, contentLength);
}

export function removePresentStyleOverlap(spans, start, end, contentLength, styleFilter = null) {
  const lo = Math.max(0, Math.min(start, end));
  const hi = Math.min(contentLength, Math.max(start, end));
  const normalized = normalizePresentStyleSpans(spans, contentLength);
  const out = [];
  for (const span of normalized) {
    if (styleFilter && span.style !== styleFilter) {
      out.push(span);
      continue;
    }
    if (span.end <= lo || span.start >= hi) {
      out.push(span);
      continue;
    }
    if (span.start < lo) out.push({ ...span, end: lo });
    if (span.end > hi) out.push({ ...span, start: hi, end: span.end, style: span.style });
  }
  return mergePresentStyleSpans(out, contentLength);
}

export function selectionHasPresentStyle(spans, start, end, contentLength, style) {
  const lo = Math.max(0, Math.min(start, end));
  const hi = Math.min(contentLength, Math.max(start, end));
  if (hi <= lo) return false;
  return normalizePresentStyleSpans(spans, contentLength).some(
    (s) => s.style === style && s.end > lo && s.start < hi
  );
}

export function presentStyleSpansForScene(sectionContent, rawStart, rawEnd, trimmedSceneText, presentStyleSpans) {
  const full = String(sectionContent ?? '');
  const trimmed = String(trimmedSceneText ?? '');
  if (!trimmed) return [];

  const rawScene = full.slice(rawStart, rawEnd);
  const lead = rawScene.indexOf(trimmed);
  const leadOffset = lead >= 0 ? lead : 0;

  const local = [];
  for (const span of normalizePresentStyleSpans(presentStyleSpans, full.length)) {
    if (span.end <= rawStart || span.start >= rawEnd) continue;
    const relStart = Math.max(span.start, rawStart) - rawStart - leadOffset;
    const relEnd = Math.min(span.end, rawEnd) - rawStart - leadOffset;
    if (relEnd > relStart && relStart >= 0 && relEnd <= trimmed.length) {
      local.push({ start: relStart, end: relEnd, style: span.style });
    }
  }
  return mergePresentStyleSpans(local, trimmed.length);
}

export function resolveSceneLayout(localStyleSpans) {
  for (const s of localStyleSpans) {
    if (s.style === 'align-left') return 'left';
  }
  return 'center';
}

export function buildPresentStyledParts(text, headlineSpans, presentStyleSpans) {
  const content = String(text ?? '');
  if (!content) return [];

  const headlines = normalizeHeadlineSpans(headlineSpans, content.length);
  const styles = normalizePresentStyleSpans(presentStyleSpans, content.length);

  const points = new Set([0, content.length]);
  for (const s of headlines) {
    points.add(s.start);
    points.add(s.end);
  }
  for (const s of styles) {
    if (PRESENT_TEXT_STYLES.includes(s.style)) {
      points.add(s.start);
      points.add(s.end);
    }
  }
  const sorted = [...points].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (end <= start) continue;
    const headline = headlines.some((h) => h.start <= start && h.end >= end);
    const emphasis = styles.some((s) => s.style === 'emphasis' && s.start <= start && s.end >= end);
    const caption = styles.some((s) => s.style === 'caption' && s.start <= start && s.end >= end);
    const large = styles.some((s) => s.style === 'large' && s.start <= start && s.end >= end);
    const whisper = styles.some((s) => s.style === 'whisper' && s.start <= start && s.end >= end);
    parts.push({ text: content.slice(start, end), headline, emphasis, caption, large, whisper });
  }
  return parts.length ? parts : [{ text: content, headline: false, emphasis: false, caption: false, large: false, whisper: false }];
}

export function presentStyledPartsForScene(sectionContent, rawStart, rawEnd, trimmedSceneText, headlineSpans, presentStyleSpans) {
  const full = String(sectionContent ?? '');
  const trimmed = String(trimmedSceneText ?? '');
  if (!trimmed) return [{ text: '', headline: false, emphasis: false, caption: false, large: false, whisper: false }];

  const rawScene = full.slice(rawStart, rawEnd);
  const lead = rawScene.indexOf(trimmed);
  const leadOffset = lead >= 0 ? lead : 0;

  const localHeadlines = [];
  for (const span of normalizeHeadlineSpans(headlineSpans, full.length)) {
    if (span.end <= rawStart || span.start >= rawEnd) continue;
    const relStart = Math.max(span.start, rawStart) - rawStart - leadOffset;
    const relEnd = Math.min(span.end, rawEnd) - rawStart - leadOffset;
    if (relEnd > relStart && relStart >= 0 && relEnd <= trimmed.length) {
      localHeadlines.push({ start: relStart, end: relEnd });
    }
  }
  const localStyles = presentStyleSpansForScene(full, rawStart, rawEnd, trimmed, presentStyleSpans);
  return buildPresentStyledParts(trimmed, mergeHeadlineSpans(localHeadlines, trimmed.length), localStyles);
}

export function partsForLineText(lineText, styledParts) {
  const line = String(lineText ?? '');
  if (!line || !styledParts?.length) {
    return [{ text: line, headline: false, emphasis: false, caption: false, large: false, whisper: false }];
  }
  const trimmed = line.trim();
  if (!trimmed) {
    return [{ text: line, headline: false, emphasis: false, caption: false, large: false, whisper: false }];
  }
  for (const part of styledParts) {
    if (part.text.trim() === trimmed) {
      return [{ ...part, text: line }];
    }
  }
  return [{ text: line, headline: false, emphasis: false, caption: false, large: false, whisper: false }];
}

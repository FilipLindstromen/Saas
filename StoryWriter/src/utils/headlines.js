/** @typedef {{ start: number, end: number }} HeadlineSpan */

import { remapOffsetSpans } from './textEditMap';

export function normalizeHeadlineSpans(spans, contentLength) {
  const len = Math.max(0, Number(contentLength) || 0);
  if (!Array.isArray(spans)) return [];
  return spans
    .map((s) => ({
      start: Math.max(0, Math.min(len, Number(s.start) || 0)),
      end: Math.max(0, Math.min(len, Number(s.end) || 0)),
    }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);
}

export function remapHeadlineSpans(oldContent, newContent, spans) {
  return remapOffsetSpans(oldContent, newContent, spans, normalizeHeadlineSpans, mergeHeadlineSpans);
}

export function mergeHeadlineSpans(spans, contentLength) {
  const normalized = normalizeHeadlineSpans(spans, contentLength);
  if (!normalized.length) return [];
  const merged = [{ ...normalized[0] }];
  for (let i = 1; i < normalized.length; i++) {
    const prev = merged[merged.length - 1];
    const cur = normalized[i];
    if (cur.start <= prev.end) {
      prev.end = Math.max(prev.end, cur.end);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

export function addHeadlineSpan(spans, start, end, contentLength) {
  const lo = Math.max(0, Math.min(start, end));
  const hi = Math.min(contentLength, Math.max(start, end));
  if (hi <= lo) return normalizeHeadlineSpans(spans, contentLength);
  return mergeHeadlineSpans([...normalizeHeadlineSpans(spans, contentLength), { start: lo, end: hi }], contentLength);
}

export function removeHeadlineSpanOverlap(spans, start, end, contentLength) {
  const lo = Math.max(0, Math.min(start, end));
  const hi = Math.min(contentLength, Math.max(start, end));
  const normalized = normalizeHeadlineSpans(spans, contentLength);
  const out = [];
  for (const span of normalized) {
    if (span.end <= lo || span.start >= hi) {
      out.push(span);
      continue;
    }
    if (span.start < lo) out.push({ start: span.start, end: lo });
    if (span.end > hi) out.push({ start: hi, end: span.end });
  }
  return mergeHeadlineSpans(out, contentLength);
}

export function selectionIsHeadline(spans, start, end, contentLength) {
  const lo = Math.max(0, Math.min(start, end));
  const hi = Math.min(contentLength, Math.max(start, end));
  if (hi <= lo) return false;
  const normalized = normalizeHeadlineSpans(spans, contentLength);
  return normalized.some((s) => s.start <= lo && s.end >= hi);
}

export function buildStyledTextParts(text, headlineSpans) {
  const content = String(text ?? '');
  const spans = normalizeHeadlineSpans(headlineSpans, content.length);
  if (!content) return [];
  if (!spans.length) return [{ text: content, headline: false }];

  const points = new Set([0, content.length]);
  for (const s of spans) {
    points.add(s.start);
    points.add(s.end);
  }
  const sorted = [...points].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (end <= start) continue;
    const headline = spans.some((s) => s.start <= start && s.end >= end);
    parts.push({ text: content.slice(start, end), headline });
  }
  return parts.length ? parts : [{ text: content, headline: false }];
}

export function headlinePartsForScene(sectionContent, rawStart, rawEnd, trimmedSceneText, headlineSpans) {
  const full = String(sectionContent ?? '');
  const trimmed = String(trimmedSceneText ?? '');
  if (!trimmed) return [{ text: '', headline: false }];

  const rawScene = full.slice(rawStart, rawEnd);
  const lead = rawScene.indexOf(trimmed);
  const leadOffset = lead >= 0 ? lead : 0;

  const localSpans = [];
  for (const span of normalizeHeadlineSpans(headlineSpans, full.length)) {
    if (span.end <= rawStart || span.start >= rawEnd) continue;
    const relStart = Math.max(span.start, rawStart) - rawStart - leadOffset;
    const relEnd = Math.min(span.end, rawEnd) - rawStart - leadOffset;
    if (relEnd > relStart && relStart >= 0 && relEnd <= trimmed.length) {
      localSpans.push({ start: relStart, end: relEnd });
    }
  }
  return buildStyledTextParts(trimmed, mergeHeadlineSpans(localSpans, trimmed.length));
}

import { normalizeHeadlineSpans, mergeHeadlineSpans } from './headlines';

export const normalizeRotateSpans = normalizeHeadlineSpans;
export const mergeRotateSpans = mergeHeadlineSpans;
export const remapRotateSpans = remapRotateSpansImpl;
export const addRotateSpan = addRotateSpanImpl;
export const removeRotateSpanOverlap = removeRotateSpanOverlapImpl;
export const selectionIsRotate = selectionIsRotateImpl;

function remapRotateSpansImpl(oldContent, newContent, spans) {
  const old = String(oldContent ?? '');
  const next = String(newContent ?? '');
  const normalized = normalizeRotateSpans(spans, old.length);
  const out = [];
  for (const span of normalized) {
    const snippet = old.slice(span.start, span.end);
    if (!snippet) continue;
    const idx = next.indexOf(snippet);
    if (idx < 0) continue;
    out.push({ start: idx, end: idx + snippet.length });
  }
  return mergeRotateSpans(out, next.length);
}

function addRotateSpanImpl(spans, start, end, contentLength) {
  const lo = Math.max(0, Math.min(start, end));
  const hi = Math.min(contentLength, Math.max(start, end));
  if (hi <= lo) return normalizeRotateSpans(spans, contentLength);
  return mergeRotateSpans([...normalizeRotateSpans(spans, contentLength), { start: lo, end: hi }], contentLength);
}

function removeRotateSpanOverlapImpl(spans, start, end, contentLength) {
  const lo = Math.max(0, Math.min(start, end));
  const hi = Math.min(contentLength, Math.max(start, end));
  const normalized = normalizeRotateSpans(spans, contentLength);
  const out = [];
  for (const span of normalized) {
    if (span.end <= lo || span.start >= hi) {
      out.push(span);
      continue;
    }
    if (span.start < lo) out.push({ start: span.start, end: lo });
    if (span.end > hi) out.push({ start: hi, end: span.end });
  }
  return mergeRotateSpans(out, contentLength);
}

function selectionIsRotateImpl(spans, start, end, contentLength) {
  const lo = Math.max(0, Math.min(start, end));
  const hi = Math.min(contentLength, Math.max(start, end));
  if (hi <= lo) return false;
  return normalizeRotateSpans(spans, contentLength).some((s) => s.start <= lo && s.end >= hi);
}

export function selectionOverlapsRotate(spans, start, end, contentLength) {
  const lo = Math.max(0, Math.min(start, end));
  const hi = Math.min(contentLength, Math.max(start, end));
  if (hi <= lo) return false;
  return normalizeRotateSpans(spans, contentLength).some((s) => s.end > lo && s.start < hi);
}

export const normalizeBulletSpans = normalizeRotateSpans;
export const mergeBulletSpans = mergeRotateSpans;
export const remapBulletSpans = remapRotateSpansImpl;
export const addBulletSpan = addRotateSpanImpl;
export const removeBulletSpanOverlap = removeRotateSpanOverlapImpl;
export const selectionIsBullet = selectionIsRotateImpl;
export const selectionOverlapsBullet = selectionOverlapsRotate;

export function rotateSpansForScene(sectionContent, rawStart, rawEnd, trimmedSceneText, rotateSpans) {
  const full = String(sectionContent ?? '');
  const trimmed = String(trimmedSceneText ?? '');
  if (!trimmed) return [];

  const rawScene = full.slice(rawStart, rawEnd);
  const lead = rawScene.indexOf(trimmed);
  const leadOffset = lead >= 0 ? lead : 0;

  const localSpans = [];
  for (const span of normalizeRotateSpans(rotateSpans, full.length)) {
    if (span.end <= rawStart || span.start >= rawEnd) continue;
    const relStart = Math.max(span.start, rawStart) - rawStart - leadOffset;
    const relEnd = Math.min(span.end, rawEnd) - rawStart - leadOffset;
    if (relEnd > relStart && relStart >= 0 && relEnd <= trimmed.length) {
      localSpans.push({ start: relStart, end: relEnd });
    }
  }
  return mergeRotateSpans(localSpans, trimmed.length);
}

export const bulletSpansForScene = rotateSpansForScene;

function collectTaggedRevealSpans(text, rotateSpans, bulletSpans) {
  const len = text.length;
  const tagged = [];
  for (const s of normalizeRotateSpans(rotateSpans, len)) {
    tagged.push({ ...s, variant: 'rotate' });
  }
  for (const s of normalizeRotateSpans(bulletSpans, len)) {
    tagged.push({ ...s, variant: 'bullet' });
  }
  tagged.sort((a, b) => a.start - b.start || a.end - b.end);
  return tagged;
}

export function getLineRevealStepCount(sceneText, rotateSpansLocal, bulletSpansLocal = []) {
  const text = String(sceneText ?? '');
  const tagged = collectTaggedRevealSpans(text, rotateSpansLocal, bulletSpansLocal);
  if (!tagged.length) return 1;
  let maxLines = 1;
  for (const span of tagged) {
    const lineCount = text.slice(span.start, span.end).split('\n').length;
    maxLines = Math.max(maxLines, lineCount);
  }
  return maxLines;
}

export function getRotateStepCount(sceneText, rotateSpansLocal) {
  return getLineRevealStepCount(sceneText, rotateSpansLocal, []);
}

/** Rotating lines: only the active line is visible at each step. */
export function appendRotateRevealLines(rows, lines, stepIndex) {
  const lineIdx = Math.min(stepIndex, lines.length - 1);
  rows.push({
    kind: 'line',
    text: lines[lineIdx],
    variant: 'rotate',
    animate: stepIndex < lines.length && lineIdx === stepIndex,
  });
}

/** Bullet list: cumulative lines (1, then 1+2, then 1+2+3…); newest line animates in. */
export function appendBulletRevealLines(rows, lines, stepIndex) {
  const visible = Math.min(stepIndex + 1, lines.length);
  for (let i = 0; i < visible; i++) {
    rows.push({
      kind: 'line',
      text: lines[i],
      variant: 'bullet',
      animate: i === visible - 1 && stepIndex < lines.length,
    });
  }
}

/** Line-by-line reveal for rotate and/or bullet spans in one scene. */
export function buildLineRevealRowsSimple(sceneText, rotateSpansLocal, bulletSpansLocal, stepIndex) {
  const text = String(sceneText ?? '');
  const tagged = collectTaggedRevealSpans(text, rotateSpansLocal, bulletSpansLocal);
  if (!tagged.length) return null;

  const rows = [];
  let cursor = 0;
  const totalSteps = getLineRevealStepCount(text, rotateSpansLocal, bulletSpansLocal);

  for (const span of tagged) {
    if (span.start > cursor) {
      rows.push({ kind: 'static', text: text.slice(cursor, span.start) });
    }
    const block = text.slice(span.start, span.end);
    const lines = block.split('\n');
    if (span.variant === 'bullet') {
      appendBulletRevealLines(rows, lines, stepIndex);
    } else {
      appendRotateRevealLines(rows, lines, stepIndex);
    }
    cursor = span.end;
  }
  if (cursor < text.length && stepIndex >= totalSteps - 1) {
    rows.push({ kind: 'static', text: text.slice(cursor) });
  }

  return rows;
}

export function buildRotateRevealRowsSimple(sceneText, rotateSpansLocal, stepIndex) {
  const text = String(sceneText ?? '');
  const tagged = collectTaggedRevealSpans(text, rotateSpansLocal, []);
  if (!tagged.length) return null;
  const rows = [];
  let cursor = 0;
  const totalSteps = getLineRevealStepCount(text, rotateSpansLocal, []);
  for (const span of tagged) {
    if (span.start > cursor) {
      rows.push({ kind: 'static', text: text.slice(cursor, span.start) });
    }
    const lines = text.slice(span.start, span.end).split('\n');
    appendRotateRevealLines(rows, lines, stepIndex);
    cursor = span.end;
  }
  if (cursor < text.length && stepIndex >= totalSteps - 1) {
    rows.push({ kind: 'static', text: text.slice(cursor) });
  }
  return rows;
}

export function buildBulletRevealRowsSimple(sceneText, bulletSpansLocal, stepIndex) {
  const text = String(sceneText ?? '');
  const tagged = collectTaggedRevealSpans(text, [], bulletSpansLocal);
  if (!tagged.length) return null;
  const rows = [];
  let cursor = 0;
  const totalSteps = getLineRevealStepCount(text, [], bulletSpansLocal);
  for (const span of tagged) {
    if (span.start > cursor) {
      rows.push({ kind: 'static', text: text.slice(cursor, span.start) });
    }
    const lines = text.slice(span.start, span.end).split('\n');
    appendBulletRevealLines(rows, lines, stepIndex);
    cursor = span.end;
  }
  if (cursor < text.length && stepIndex >= totalSteps - 1) {
    rows.push({ kind: 'static', text: text.slice(cursor) });
  }
  return rows;
}

export function applyHeadlineToLineText(lineText, styledParts) {
  if (!styledParts?.length || !lineText) {
    return [{ text: lineText, headline: false }];
  }
  const trimmed = lineText.trim();
  if (!trimmed) return [{ text: lineText, headline: false }];
  for (const part of styledParts) {
    if (part.headline && part.text.trim() === trimmed) {
      return [{ text: lineText, headline: true }];
    }
  }
  return [{ text: lineText, headline: false }];
}

/** Author marker: show background only in Present — hidden in the rendered text. */
export const PRESENT_IMAGE_PLACEHOLDER = '[IMAGE]';

export function isPresentImagePlaceholderLine(line) {
  return String(line ?? '').trim() === PRESENT_IMAGE_PLACEHOLDER;
}

/** Character ranges in raw editor text for lines that are exactly `[IMAGE]`. */
export function getPresentImagePlaceholderRanges(content) {
  const raw = String(content ?? '');
  const ranges = [];
  let offset = 0;
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = offset;
    const lineEnd = offset + line.length;
    if (isPresentImagePlaceholderLine(line)) {
      ranges.push({ start: lineStart, end: lineEnd });
    }
    offset = lineEnd + (i < lines.length - 1 ? 1 : 0);
  }
  return ranges;
}

export function sceneUsesPresentImagePlaceholder(text) {
  return getPresentImagePlaceholderRanges(text).length > 0;
}

/** Remove lines that contain only [IMAGE] (present display text). */
export function stripPresentImagePlaceholderLines(text) {
  const lines = String(text ?? '').split('\n');
  const kept = lines.filter((line) => !isPresentImagePlaceholderLine(line));
  return kept
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function revealRowHasVisibleText(row) {
  if (!row) return false;
  if (row.kind === 'static') return Boolean(String(row.text ?? '').trim());
  if (row.kind === 'line') return Boolean(String(row.text ?? '').trim());
  if (row.kind === 'rotate-step') return Boolean(String(row.text ?? '').trim());
  return false;
}

/** Strip [IMAGE] from line-reveal rows; flag image-only steps (no visible text left). */
export function processPresentRevealRows(rows) {
  if (!rows?.length) return { rows: null, stepImageOnly: false };

  const out = [];
  let sawPlaceholderStep = false;

  for (const row of rows) {
    if (row.kind === 'static') {
      const text = stripPresentImagePlaceholderLines(row.text);
      if (text.trim()) out.push({ ...row, text });
      continue;
    }
    if (row.kind === 'line') {
      if (isPresentImagePlaceholderLine(row.text)) continue;
      out.push(row);
      continue;
    }
    if (row.kind === 'rotate-step') {
      if (isPresentImagePlaceholderLine(row.text)) {
        sawPlaceholderStep = true;
        const prev = isPresentImagePlaceholderLine(row.previousText) ? null : row.previousText;
        out.push({ ...row, text: '', previousText: prev ?? null });
      } else {
        const prev = isPresentImagePlaceholderLine(row.previousText) ? null : row.previousText;
        out.push({ ...row, previousText: prev ?? null });
      }
    }
  }

  const hasVisible = out.some(revealRowHasVisibleText);
  const stepImageOnly = sawPlaceholderStep && !hasVisible;
  return { rows: out.length ? out : null, stepImageOnly };
}

export function isPresentImageOnlyScene(text, processedRows) {
  const stripped = stripPresentImagePlaceholderLines(text);
  if (stripped.trim()) return false;
  if (processedRows?.rows?.length) {
    return !processedRows.rows.some(revealRowHasVisibleText);
  }
  return true;
}

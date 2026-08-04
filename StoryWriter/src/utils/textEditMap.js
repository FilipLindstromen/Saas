/**
 * Map a character index in oldText to the corresponding index in newText after an edit,
 * assuming a single contiguous change between shared prefix/suffix (typical per keystroke).
 */
export function mapOldIndexToNew(oldText, newText, oldIndex) {
  const old = String(oldText ?? '');
  const next = String(newText ?? '');
  const idx = Math.max(0, Math.min(old.length, Math.floor(Number(oldIndex) || 0)));

  let prefix = 0;
  const maxPrefix = Math.min(old.length, next.length);
  while (prefix < maxPrefix && old[prefix] === next[prefix]) prefix += 1;

  let suffix = 0;
  const maxSuffix = Math.min(old.length - prefix, next.length - prefix);
  while (
    suffix < maxSuffix &&
    old[old.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const oldMidStart = prefix;
  const oldMidEnd = old.length - suffix;
  const newMidStart = prefix;
  const newMidEnd = next.length - suffix;

  if (idx <= prefix) return idx;
  if (idx >= oldMidEnd) {
    return Math.max(0, Math.min(next.length, next.length - suffix + (idx - oldMidEnd)));
  }

  const oldMidLen = oldMidEnd - oldMidStart;
  const newMidLen = newMidEnd - newMidStart;
  if (oldMidLen === 0) return newMidStart;
  const rel = idx - oldMidStart;
  return Math.max(0, Math.min(next.length, newMidStart + Math.min(rel, newMidLen)));
}

/** Remap { start, end, ...rest } spans through a text edit (end is exclusive). */
export function remapOffsetSpans(oldContent, newContent, spans, normalize, merge) {
  const old = String(oldContent ?? '');
  const next = String(newContent ?? '');
  const normalized = normalize(spans, old.length);
  const out = [];
  for (const span of normalized) {
    const start = mapOldIndexToNew(old, next, span.start);
    const end = mapOldIndexToNew(old, next, span.end);
    if (end > start) {
      out.push({ ...span, start, end });
    }
  }
  return merge(out, next.length);
}

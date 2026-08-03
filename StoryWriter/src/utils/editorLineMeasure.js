/** Character offsets where a new line starts (first line always at 0). */
export function getLineStartOffsets(text) {
  const s = String(text ?? '');
  const offsets = [0];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\n') offsets.push(i + 1);
  }
  return offsets;
}

/** Y positions (px) of each line start relative to `measureEl` top — matches textarea wrapping. */
export function measureLineTops(measureEl, text) {
  if (!measureEl) return [];
  const s = String(text ?? '');
  const offsets = getLineStartOffsets(s);
  if (!s.length) return [0];

  const textNode = measureEl.firstChild;
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return offsets.map(() => 0);

  const baseTop = measureEl.getBoundingClientRect().top;
  const tops = [];

  for (const offset of offsets) {
    const pos = Math.min(offset, s.length);
    const range = document.createRange();
    try {
      range.setStart(textNode, pos);
      range.setEnd(textNode, pos);
      const rect = range.getBoundingClientRect();
      tops.push(rect.top - baseTop);
    } catch {
      tops.push(tops.length ? tops[tops.length - 1] : 0);
    }
  }

  return tops;
}

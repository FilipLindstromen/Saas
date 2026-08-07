import { useState, useCallback, useEffect, useLayoutEffect } from 'react';
import { measureLineTops } from '../utils/editorLineMeasure';

const FALLBACK_LINE_HEIGHT = 28;

function fallbackTops(lineCount) {
  const n = Math.max(1, Number(lineCount) || 1);
  return Array.from({ length: n }, (_, i) => i * FALLBACK_LINE_HEIGHT);
}

function topsToLineHeights(tops, containerHeight) {
  if (!tops.length) return [];
  return tops.map((top, i) => {
    if (i < tops.length - 1) return Math.max(1, tops[i + 1] - top);
    return Math.max(FALLBACK_LINE_HEIGHT, (containerHeight || 0) - top);
  });
}

/**
 * Gutter line alignment for the unified Edit textarea.
 * Keeps measure callbacks declared before effects that use them (avoids TDZ crashes).
 */
export function useUnifiedEditGutter({ content, gutterLineCount, measureRef, wrapRef, textareaRef, bodyRef }) {
  const [gutterTops, setGutterTops] = useState(() => fallbackTops(gutterLineCount));
  const [gutterHeights, setGutterHeights] = useState(() =>
    Array.from({ length: Math.max(1, gutterLineCount) }, () => FALLBACK_LINE_HEIGHT)
  );

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    const wrap = wrapRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const h = Math.max(el.scrollHeight, 320);
    el.style.height = `${h}px`;
    if (wrap) wrap.style.minHeight = `${h}px`;
  }, [textareaRef, wrapRef]);

  const remeasureGutter = useCallback(() => {
    const measureEl = measureRef.current;
    if (!measureEl) {
      setGutterTops(fallbackTops(gutterLineCount));
      setGutterHeights(Array.from({ length: Math.max(1, gutterLineCount) }, () => FALLBACK_LINE_HEIGHT));
      return;
    }
    try {
      const tops = measureLineTops(measureEl, content);
      if (!tops.length) {
        setGutterTops(fallbackTops(gutterLineCount));
        setGutterHeights(Array.from({ length: gutterLineCount }, () => FALLBACK_LINE_HEIGHT));
        return;
      }
      setGutterTops(tops);
      setGutterHeights(topsToLineHeights(tops, measureEl.offsetHeight));
    } catch (err) {
      console.warn('[Edit] Gutter measurement failed:', err);
      setGutterTops(fallbackTops(gutterLineCount));
      setGutterHeights(Array.from({ length: Math.max(1, gutterLineCount) }, () => FALLBACK_LINE_HEIGHT));
    }
  }, [content, gutterLineCount, measureRef]);

  useEffect(() => {
    const n = Math.max(1, gutterLineCount);
    setGutterHeights((prev) => {
      if (prev.length === n) return prev;
      return Array.from({ length: n }, (_, i) => prev[i] ?? FALLBACK_LINE_HEIGHT);
    });
  }, [gutterLineCount]);

  useEffect(() => {
    adjustHeight();
    const frame = requestAnimationFrame(() => remeasureGutter());
    return () => cancelAnimationFrame(frame);
  }, [content, adjustHeight, remeasureGutter]);

  useLayoutEffect(() => {
    remeasureGutter();
  }, [remeasureGutter, gutterLineCount]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => remeasureGutter());
    ro.observe(body);
    window.addEventListener('resize', remeasureGutter);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', remeasureGutter);
    };
  }, [bodyRef, remeasureGutter]);

  return { gutterTops, gutterHeights, adjustHeight, remeasureGutter };
}

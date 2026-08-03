import { useState, useCallback, useEffect, useLayoutEffect } from 'react';
import { measureLineTops } from '../utils/editorLineMeasure';

const FALLBACK_LINE_HEIGHT = 28;

function fallbackTops(lineCount) {
  const n = Math.max(1, Number(lineCount) || 1);
  return Array.from({ length: n }, (_, i) => i * FALLBACK_LINE_HEIGHT);
}

/**
 * Gutter line alignment for the unified Edit textarea.
 * Keeps measure callbacks declared before effects that use them (avoids TDZ crashes).
 */
export function useUnifiedEditGutter({ content, gutterLineCount, measureRef, wrapRef, textareaRef, bodyRef }) {
  const [gutterTops, setGutterTops] = useState(() => fallbackTops(gutterLineCount));

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
      return;
    }
    try {
      const tops = measureLineTops(measureEl, content);
      if (!tops.length) {
        setGutterTops(fallbackTops(gutterLineCount));
        return;
      }
      setGutterTops(tops);
    } catch (err) {
      console.warn('[Edit] Gutter measurement failed:', err);
      setGutterTops(fallbackTops(gutterLineCount));
    }
  }, [content, gutterLineCount, measureRef]);

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

  return { gutterTops, adjustHeight, remeasureGutter };
}

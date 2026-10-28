import { useCallback, useEffect, useRef, useState } from 'react';

// Pacing: a base duration from WPM, stretched a bit for longer words and
// with extra breathing room at language switches / pair boundaries so a
// sentence pair doesn't blur into the next one.
function getDurationMs(token, wpm) {
  const base = 60000 / wpm;
  let duration = base * Math.min(2, 0.6 + token.text.length / 8);
  if (token.isLangSwitch) duration += base * 0.6;
  if (token.isPairEnd) duration += base * 0.9;
  return duration;
}

// `skipLang` passes over every token of one language (e.g. Swedish while it is
// shown as a small hint instead), so it can be toggled mid-play without
// rebuilding the stream or losing the current position.
export function useRSVPPlayer(tokens, wpm, skipLang = null) {
  const [rawIndex, setRawIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef(null);

  let index = rawIndex;
  if (skipLang) {
    while (index < tokens.length && tokens[index].lang === skipLang) index++;
  }

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    clearTimer();
    if (!isPlaying) return undefined;

    const token = tokens[index];
    if (!token) {
      setIsPlaying(false);
      return undefined;
    }

    timerRef.current = setTimeout(() => {
      setRawIndex(index + 1);
    }, getDurationMs(token, wpm));

    return clearTimer;
  }, [index, isPlaying, tokens, wpm]);

  // Reset playback whenever the underlying text changes.
  useEffect(() => {
    clearTimer();
    setRawIndex(0);
    setIsPlaying(false);
  }, [tokens]);

  const play = useCallback(() => {
    setRawIndex((i) => (i >= tokens.length ? 0 : i));
    setIsPlaying(true);
  }, [tokens.length]);

  const pause = useCallback(() => setIsPlaying(false), []);

  const restart = useCallback(() => {
    setRawIndex(0);
    setIsPlaying(true);
  }, []);

  return {
    currentToken: tokens[index] ?? null,
    index,
    isPlaying,
    play,
    pause,
    restart,
    isFinished: tokens.length > 0 && index >= tokens.length,
  };
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { parseText, buildTokenStream, buildTimedTokenStream } from '../lib/parse';
import {
  generateWordBasedColors,
  generateRainbowColors,
  darkenColor,
  LANGUAGE_COLORS,
} from '../lib/colors';
import { formatSeconds } from '../lib/format';
import { useRSVPPlayer } from '../hooks/useRSVPPlayer';
import { useCountdown } from '../hooks/useCountdown';
import WordDisplay from './WordDisplay';
import Controls from './Controls';

// Comfortably outlasts any WPM setting (max slider value is 600) for the
// chosen duration, so the timed stream never runs dry before time is up.
const TOKENS_PER_MINUTE_CEILING = 700;

export default function ReaderScreen({
  rawText,
  colorMode,
  setColorMode,
  wpm,
  setWpm,
  sessionMinutes,
  svHint,
  setSvHint,
  onBack,
}) {
  const { pairs } = useMemo(() => parseText(rawText), [rawText]);
  const tokens = useMemo(() => {
    if (!sessionMinutes) return buildTokenStream(pairs);
    return buildTimedTokenStream(pairs, sessionMinutes * TOKENS_PER_MINUTE_CEILING);
  }, [pairs, sessionMinutes]);

  const wordColors = useMemo(() => generateWordBasedColors(pairs.length), [pairs.length]);
  const rainbowColors = useMemo(() => generateRainbowColors(pairs.length), [pairs.length]);
  // Color BG reuses the same random per-pair palette, just applied to the
  // background instead of the focus letter.
  const bgColors = wordColors;

  // With the hint on, Swedish is shown small above the English word instead of
  // being flashed as its own big word, so English gets the screen time.
  const player = useRSVPPlayer(tokens, wpm, svHint ? 'sv' : null);
  const token = player.currentToken;
  const hint = svHint && token && token.lang === 'en' ? token.svText : null;

  // The single color that identifies a pair, used for the completed-pair
  // flash. Language mode has no single per-pair color (it's blue/red by
  // word), so it falls back to the language a pair always ends on.
  const getPairIdentityColor = (pairIndex) => {
    if (colorMode === 'word') return wordColors[pairIndex] ?? LANGUAGE_COLORS.sv;
    if (colorMode === 'wordSequence') return rainbowColors[pairIndex] ?? LANGUAGE_COLORS.sv;
    if (colorMode === 'colorBg') return bgColors[pairIndex] ?? LANGUAGE_COLORS.sv;
    return LANGUAGE_COLORS.en;
  };

  const bgColor =
    colorMode === 'colorBg' && token ? bgColors[token.pairIndex] ?? LANGUAGE_COLORS.sv : undefined;

  const focusColor = (() => {
    if (!token) return LANGUAGE_COLORS.sv;
    if (colorMode === 'language') return LANGUAGE_COLORS[token.lang];
    if (colorMode === 'colorBg') return darkenColor(bgColor);
    return getPairIdentityColor(token.pairIndex);
  })();

  // Flash the just-completed pair's color right as the next pair's first
  // word appears, so the start of the next thing to learn reads clearly.
  // Keyed on the stream position where the pair begins (not pair identity,
  // since timed mode reshuffles and can repeat a pair back to back). Working
  // from that position also keeps it right when Swedish words are skipped, and
  // avoids a false flash if the hint is toggled mid-pair.
  const [flash, setFlash] = useState(null);
  const lastPairStartRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    const pairStart = player.index - token.wordIndexInPair;
    const isNewPair = lastPairStartRef.current !== pairStart;
    lastPairStartRef.current = pairStart;
    if (isNewPair && pairStart > 0) {
      setFlash({
        key: `${pairStart}`,
        color: getPairIdentityColor(tokens[pairStart - 1].pairIndex),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Timed training: same words, random order, capped to N minutes of actual
  // play time (pausing pauses the clock). Untimed sessions get totalSeconds
  // = null, so the countdown simply never starts.
  const totalSeconds = sessionMinutes ? sessionMinutes * 60 : null;
  const countdown = useCountdown(totalSeconds, player.isPlaying);

  useEffect(() => {
    if (countdown.expired) player.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown.expired]);

  const handleRestart = () => {
    countdown.reset();
    player.restart();
  };

  return (
    <div className="reader-screen">
      <WordDisplay token={token} focusColor={focusColor} bgColor={bgColor} hint={hint} />

      {flash && (
        <div
          key={flash.key}
          className="flash-overlay"
          style={{ backgroundColor: flash.color }}
          onAnimationEnd={() => setFlash(null)}
        />
      )}

      {(player.isFinished || countdown.expired) && (
        <div className="finished-banner">
          {countdown.expired ? "Time's up!" : 'Done!'} Press restart to go again.
        </div>
      )}

      <Controls
        isPlaying={player.isPlaying}
        onPlayPause={player.isPlaying ? player.pause : player.play}
        onRestart={handleRestart}
        onBack={onBack}
        wpm={wpm}
        onWpmChange={setWpm}
        colorMode={colorMode}
        onColorModeChange={setColorMode}
        svHint={svHint}
        onSvHintChange={setSvHint}
        currentPairIndex={token ? token.pairIndex : pairs.length - 1}
        totalPairs={pairs.length}
        timeLabel={sessionMinutes ? (countdown.expired ? "Time's up" : formatSeconds(countdown.secondsLeft)) : null}
      />
    </div>
  );
}

import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Chrome } from '../shared/Chrome';
import { Line } from '../shared/Line';
import { SceneBackdrop } from '../shared/SceneBackdrop';
import { sceneCaptionText } from '../shared/caption';
import { animate, Easing } from '../shared/motion';
import type { SceneComponentProps } from '../shared/sceneProps';

function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

const FALL_DISTANCE = 130;

interface LineTiming {
  start: number;
  fallDur: number;
  pauseDur: number;
}

// Splits the scene's duration across its lines proportionally to word count (longer lines
// get more read time), back-to-back with no gap or overlap — each line's segment is exactly
// [start, start + fallDur + pauseDur + fallDur].
function layoutLines(lines: { text: string }[], dur: number): LineTiming[] {
  const weights = lines.map((l) => Math.max(1, wordCount(l.text)));
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
  let cursor = 0;
  return lines.map((_, i) => {
    const segDur = (dur * weights[i]) / totalWeight;
    const fallDur = Math.min(0.45, segDur * 0.28);
    const start = cursor;
    cursor += segDur;
    return { start, fallDur, pauseDur: Math.max(0, segDur - fallDur * 2) };
  });
}

// Fall from above while fading in, hold in place (readable), then continue falling while
// fading out — a single eased motion per line, not the word-by-word stagger the other styles
// use.
function fallMotion(t: number, { start, fallDur, pauseDur }: LineTiming) {
  const fallInEnd = start + fallDur;
  const pauseEnd = fallInEnd + pauseDur;
  const fallOutEnd = pauseEnd + fallDur;
  if (t <= fallInEnd) {
    const p = animate(t, { from: 0, to: 1, start, end: fallInEnd, ease: Easing.easeOutCubic });
    return { opacity: p, y: -FALL_DISTANCE * (1 - p) };
  }
  if (t <= pauseEnd) return { opacity: 1, y: 0 };
  const p = animate(t, { from: 0, to: 1, start: pauseEnd, end: fallOutEnd, ease: Easing.easeInCubic });
  return { opacity: 1 - p, y: FALL_DISTANCE * p };
}

// Lines fall in one at a time, from the top, fading from 0 opacity as they drop; pause in
// place long enough to read; then fall further and fade back out before the next line starts.
export function FallingLinesScene({ scene, theme, t, dur, label, showCaptions, showTimecode, sceneIndex, sceneCount, elapsedSec, totalSec, video }: SceneComponentProps) {
  const layout = layoutLines(scene.lines, dur);
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <SceneBackdrop broll={scene.broll} video={video} ink={theme.ink} />
      <Chrome
        theme={theme}
        label={label}
        caption={sceneCaptionText(scene)}
        showCaptions={showCaptions}
        showTimecode={showTimecode}
        sceneIndex={sceneIndex}
        sceneCount={sceneCount}
        elapsedSec={elapsedSec}
        totalSec={totalSec}
      />
      {scene.kicker && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-start', paddingTop: 120 }}>
          <Line
            text={scene.kicker}
            t={t}
            start={0}
            end={dur}
            size={22}
            weight={theme.kickerWeight}
            color={theme.accentDeep}
            align="center"
            letterSpacing="0.14em"
            theme={theme}
          />
        </AbsoluteFill>
      )}
      {scene.lines.map((ln, i) => {
        const { opacity, y } = fallMotion(t, layout[i]);
        if (opacity <= 0) return null;
        return (
          <AbsoluteFill key={i} style={{ alignItems: 'center', justifyContent: 'center', padding: '0 36px' }}>
            <div style={{ opacity, transform: `translateY(${y}px)` }}>
              <Line
                text={ln.text}
                t={t}
                start={-Infinity}
                end={Infinity}
                size={66 * (ln.accent ? 1.08 : 1)}
                chip={!!ln.accent && ln.emphasis !== 'marker'}
                marker={!!ln.accent && ln.emphasis === 'marker'}
                align="center"
                maxWidth={980}
                color={theme.ink}
                theme={theme}
              />
            </div>
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
}

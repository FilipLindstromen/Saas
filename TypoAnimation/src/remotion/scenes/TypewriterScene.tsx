import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Chrome } from '../shared/Chrome';
import { SceneBackdrop } from '../shared/SceneBackdrop';
import { sceneCaptionText } from '../shared/caption';
import { blink } from '../shared/motion';
import { stripInlineHighlightMarkup } from '@/lib/inlineHighlight';
import type { SceneComponentProps } from '../shared/sceneProps';

const CHAR_SEC = 0.045;

interface TypeTiming {
  start: number;
  segDur: number;
  typeDur: number;
}

// Lines accumulate top-to-bottom like a terminal log — each fully typed line stays on screen
// while the next one starts below it (unlike FallingLines/RotatingWord, which cycle a single
// slot). Segment length is allocated proportionally to character count, capped so a short line
// doesn't sit there typed-and-idle for its whole segment.
function layoutLines(lines: { text: string }[], dur: number): TypeTiming[] {
  const weights = lines.map((l) => Math.max(1, stripInlineHighlightMarkup(l.text).length));
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
  let cursor = 0;
  return lines.map((l, i) => {
    const plain = stripInlineHighlightMarkup(l.text);
    const segDur = (dur * weights[i]) / totalWeight;
    const typeDur = Math.min(segDur, plain.length * CHAR_SEC);
    const start = cursor;
    cursor += segDur;
    return { start, segDur, typeDur };
  });
}

export function TypewriterScene({ scene, theme, t, dur, label, showCaptions, showTimecode, sceneIndex, sceneCount, elapsedSec, totalSec, video }: SceneComponentProps) {
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
      <AbsoluteFill style={{ alignItems: 'flex-start', justifyContent: 'center', padding: '0 72px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 920 }}>
          {scene.kicker && (
            <div
              style={{
                fontFamily: theme.fontHeading,
                fontWeight: theme.kickerWeight,
                fontSize: 20 * theme.fontScale,
                letterSpacing: '0.14em',
                color: theme.accentDeep,
                opacity: t > 0 ? 1 : 0,
              }}
            >
              {scene.kicker}
            </div>
          )}
          {scene.lines.map((ln, i) => {
            const { start, typeDur } = layout[i];
            if (t < start) return null;
            const plain = stripInlineHighlightMarkup(ln.text);
            const local = Math.min(1, (t - start) / Math.max(0.001, typeDur));
            const shown = plain.slice(0, Math.round(local * plain.length));
            const typing = local < 1;
            return (
              <div
                key={i}
                style={{
                  fontFamily: theme.fontHeading,
                  fontWeight: ln.accent ? 700 : theme.headingWeight,
                  fontSize: 48 * theme.fontScale,
                  letterSpacing: '-0.01em',
                  color: ln.accent ? theme.accent : theme.ink,
                }}
              >
                {shown}
                {typing && <span style={{ opacity: blink(t - start), color: theme.accent }}>|</span>}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

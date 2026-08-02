import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Chrome } from '../shared/Chrome';
import { Line } from '../shared/Line';
import { SceneBackdrop } from '../shared/SceneBackdrop';
import { sceneCaptionText } from '../shared/caption';
import type { SceneComponentProps } from '../shared/sceneProps';

// Width budget (px) each line auto-fits into, and a rough average glyph width (in ems) for a
// bold sans — good enough for a "does this roughly fill the frame" heuristic without needing
// an actual text-measurement pass.
import { stripInlineHighlightMarkup } from '@/lib/inlineHighlight';

const FRAME_W = 900;
const AVG_CHAR_WIDTH = 0.62;

function fitSize(text: string): number {
  const len = Math.max(1, stripInlineHighlightMarkup(text).trim().length);
  const raw = FRAME_W / (len * AVG_CHAR_WIDTH);
  return Math.min(260, Math.max(64, raw));
}

// For scenes with very little text — a word, a short line — this auto-sizes each line as big
// as it can go while still roughly fitting the frame width, instead of a fixed size like
// Poster. Degrades gracefully for longer lines rather than clamping to illegibly small type.
export function StatementScene({ scene, theme, t, dur, label, showCaptions, showTimecode, sceneIndex, sceneCount, elapsedSec, totalSec, video }: SceneComponentProps) {
  const lineStart = 0.05;
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
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 24px', gap: 4 }}>
        {scene.kicker && (
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
            marginBottom={10}
            theme={theme}
          />
        )}
        {scene.lines.map((ln, i) => (
          <Line
            key={i}
            text={ln.text}
            t={t}
            start={lineStart + i * 0.16}
            end={dur}
            size={fitSize(ln.text)}
            weight={Math.max(theme.headingWeight, 800)}
            chip={!!ln.accent && ln.emphasis !== 'marker'}
            marker={!!ln.accent && ln.emphasis === 'marker'}
            align="center"
            maxWidth={1000}
            color={theme.ink}
            theme={theme}
          />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

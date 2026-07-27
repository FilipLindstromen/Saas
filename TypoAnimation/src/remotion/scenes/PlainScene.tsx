import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Chrome } from '../shared/Chrome';
import { Line } from '../shared/Line';
import { sceneCaptionText } from '../shared/caption';
import type { SceneComponentProps } from '../shared/sceneProps';

// Word-by-word kinetic text on a plain field — the generic, most-used scene style. Port of
// the reference's generic `Beat` component: an optional small-caps kicker, then each line
// staggered in, with `accent` lines rendered as solid-color chips.
export function PlainScene({ scene, theme, t, dur, label, showCaptions, showTimecode, sceneIndex, sceneCount, elapsedSec, totalSec }: SceneComponentProps) {
  const kickerDelay = scene.kicker ? 0.12 : 0;
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
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
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 36px', gap: 16 }}>
        {scene.kicker && (
          <Line
            text={scene.kicker}
            t={t}
            start={0}
            end={dur}
            size={24}
            weight={theme.kickerWeight}
            color={theme.accentDeep}
            align="center"
            letterSpacing="0.1em"
            marginBottom={8}
            theme={theme}
          />
        )}
        {scene.lines.map((ln, i) => (
          <Line
            key={i}
            text={ln.text}
            t={t}
            start={kickerDelay + i * 0.12}
            end={dur}
            size={66 * (ln.accent ? 1.08 : 1)}
            chip={!!ln.accent}
            align="center"
            maxWidth={980}
            color={theme.ink}
            theme={theme}
          />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Chrome } from '../shared/Chrome';
import { Line } from '../shared/Line';
import { BrollBackground } from '../shared/BrollBackground';
import { SceneVideo } from '../shared/SceneVideo';
import { draw } from '../shared/motion';
import { sceneCaptionText } from '../shared/caption';
import type { SceneComponentProps } from '../shared/sceneProps';

// A full-bleed poster statement — port of the reference's Hook/Tease/FinalCTA beats
// (generalized): larger display type on a dark/full-bleed field, with a drawn underline
// accent beneath the last line for a bit of CTA-like flourish.
export function PosterScene({ scene, theme, t, dur, label, showCaptions, showTimecode, sceneIndex, sceneCount, elapsedSec, totalSec, video }: SceneComponentProps) {
  const lineStart = 0.05;
  const lastLineStart = lineStart + Math.max(0, scene.lines.length - 1) * 0.22;
  const ruleP = draw(t, lastLineStart + 0.35, dur * 0.85);
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <BrollBackground broll={scene.broll} />
      {video?.mode === 'background' && <SceneVideo video={video} ink={theme.ink} />}
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
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 32px', gap: 6 }}>
        {scene.kicker && (
          <Line
            text={scene.kicker}
            t={t}
            start={0}
            end={dur}
            size={22}
            weight={theme.kickerWeight}
            color={theme.ink}
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
            start={lineStart + i * 0.22}
            end={dur}
            size={84 * (ln.accent ? 0.42 : 1)}
            weight={ln.accent ? 700 : theme.headingWeight}
            chip={!!ln.accent && ln.emphasis !== 'marker'}
            marker={!!ln.accent && ln.emphasis === 'marker'}
            align="center"
            maxWidth={980}
            color={theme.ink}
            marginTop={ln.accent ? 12 : undefined}
            theme={theme}
          />
        ))}
        <div
          style={{
            marginTop: 28,
            width: 220 * ruleP,
            height: 6,
            background: theme.ink,
            opacity: theme.dark ? 0.9 : 1,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

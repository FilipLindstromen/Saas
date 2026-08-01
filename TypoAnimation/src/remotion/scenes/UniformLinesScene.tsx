import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import { Chrome } from '../shared/Chrome';
import { Line } from '../shared/Line';
import { BrollBackground } from '../shared/BrollBackground';
import { SceneVideo } from '../shared/SceneVideo';
import { sceneCaptionText } from '../shared/caption';
import { fitFontSizeToWidth } from '../shared/measureText';
import type { SceneComponentProps } from '../shared/sceneProps';

// Every line's font size is solved (via real canvas text measurement, not a char-count guess)
// so it renders at the same target width as every other line — short lines blow up big, long
// lines shrink down, and the whole block reads as an even column instead of a ragged stack.
const TARGET_WIDTH = 860;

export function UniformLinesScene({ scene, theme, t, dur, label, showCaptions, showTimecode, sceneIndex, sceneCount, elapsedSec, totalSec, video }: SceneComponentProps) {
  const sizes = useMemo(
    () => scene.lines.map((ln) => fitFontSizeToWidth(ln.text, TARGET_WIDTH, theme.fontHeading, theme.headingWeight)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene.lines.map((l) => l.text).join('\n'), theme.fontHeading, theme.headingWeight]
  );

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
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 24px', gap: 6 }}>
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
            start={0.06 + i * 0.14}
            end={dur}
            size={sizes[i]}
            weight={theme.headingWeight}
            chip={!!ln.accent && ln.emphasis !== 'marker'}
            marker={!!ln.accent && ln.emphasis === 'marker'}
            align="center"
            maxWidth={TARGET_WIDTH + 60}
            color={theme.ink}
            theme={theme}
          />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

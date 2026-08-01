import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Chrome } from '../shared/Chrome';
import { Line } from '../shared/Line';
import { BrollBackground } from '../shared/BrollBackground';
import { enter, interpolateKeyframes, Easing } from '../shared/motion';
import { sceneCaptionText } from '../shared/caption';
import type { SceneComponentProps } from '../shared/sceneProps';

// An animated counting number — port of the reference's `NinetySeconds` beat, generalized
// to any target value/suffix (e.g. "90 SECONDS", "3 STEPS", "10X FASTER").
export function BigNumberScene({ scene, theme, t, dur, label, showCaptions, showTimecode, sceneIndex, sceneCount, elapsedSec, totalSec }: SceneComponentProps) {
  const target = scene.number ?? 90;
  const n = Math.round(interpolateKeyframes(t, [0.1, dur * 0.55], [0, target], Easing.easeOutCubic));
  const m = enter(t, { start: 0, end: dur });
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <BrollBackground broll={scene.broll} />
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
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <div
          style={{
            opacity: m.opacity,
            transform: m.transform,
            filter: m.filter,
            fontFamily: theme.fontHeading,
            fontWeight: theme.headingWeight,
            fontSize: 340 * theme.fontScale,
            lineHeight: 0.9,
            color: theme.accent,
          }}
        >
          {n}
          {scene.numberSuffix || ''}
        </div>
        {scene.kicker && (
          <Line
            text={scene.kicker}
            t={t}
            start={0.1}
            end={dur}
            size={40}
            weight={theme.kickerWeight}
            letterSpacing="0.14em"
            align="center"
            color={theme.ink}
            theme={theme}
          />
        )}
        {scene.lines.map((ln, i) => (
          <Line
            key={i}
            text={ln.text}
            t={t}
            start={0.5 + i * 0.12}
            end={dur}
            size={30}
            weight={700}
            align="center"
            marginTop={i === 0 ? 16 : undefined}
            color={theme.ink}
            chip={!!ln.accent && ln.emphasis !== 'marker'}
            marker={!!ln.accent && ln.emphasis === 'marker'}
            theme={theme}
          />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

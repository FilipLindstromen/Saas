import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Chrome } from '../shared/Chrome';
import { Line } from '../shared/Line';
import { BrollBackground } from '../shared/BrollBackground';
import { enter, pop } from '../shared/motion';
import { sceneCaptionText } from '../shared/caption';
import type { SceneComponentProps } from '../shared/sceneProps';

// A title line plus a wrapped row of outlined "chip" pills popping in one by one — port of
// the reference's `ContextList` beat. This is the README's "outline" treatment: each line
// becomes a bordered pill rather than filled/solid-background emphasis.
export function ChipsScene({ scene, theme, t, dur, label, showCaptions, showTimecode, sceneIndex, sceneCount, elapsedSec, totalSec }: SceneComponentProps) {
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
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 34, padding: '0 64px' }}>
        {scene.kicker && (
          <Line text={scene.kicker} t={t} start={0} end={dur} size={48} weight={theme.headingWeight} align="center" color={theme.ink} theme={theme} />
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 14, maxWidth: 820 }}>
          {scene.lines.map((ln, i) => {
            const m = enter(t, { start: 0.25 + i * 0.22, end: dur });
            const p = pop(t, 0.25 + i * 0.22, { amount: 0.14 });
            return (
              <div
                key={i}
                style={{
                  opacity: m.opacity,
                  transform: `${m.transform} scale(${p})`,
                  border: `4px solid ${theme.accent}`,
                  padding: '14px 24px',
                  fontFamily: theme.fontHeading,
                  fontWeight: theme.headingWeight,
                  fontSize: 30 * theme.fontScale,
                  color: theme.accentDeep,
                }}
              >
                {ln.text}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

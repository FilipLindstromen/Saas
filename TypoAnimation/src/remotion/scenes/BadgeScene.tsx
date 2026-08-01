import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Chrome } from '../shared/Chrome';
import { Line } from '../shared/Line';
import { BrollBackground } from '../shared/BrollBackground';
import { SceneVideo } from '../shared/SceneVideo';
import { enter } from '../shared/motion';
import { sceneCaptionText } from '../shared/caption';
import type { SceneComponentProps } from '../shared/sceneProps';

// A compact CTA stack: a bold headline (the kicker), then each line rendered as a full-width
// solid bar with an accent border stacked below it — the "TRY NOW! / CREATIVE PACK" ad-badge
// look, good for an outro or offer beat.
export function BadgeScene({ scene, theme, t, dur, label, showCaptions, showTimecode, sceneIndex, sceneCount, elapsedSec, totalSec, video }: SceneComponentProps) {
  const barBg = theme.dark ? theme.bg : theme.ink;
  const barColor = theme.dark ? theme.ink : theme.bg;
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
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 64px' }}>
        {scene.kicker && (
          <Line
            text={scene.kicker}
            t={t}
            start={0.05}
            end={dur}
            size={64}
            weight={900}
            align="center"
            color={theme.ink}
            letterSpacing="-0.01em"
            marginBottom={18}
            theme={theme}
          />
        )}
        {scene.lines.map((ln, i) => {
          const start = 0.28 + i * 0.18;
          const m = enter(t, { start, end: dur, inDur: 0.28, outDur: 0.18, rise: 26 });
          return (
            <div
              key={i}
              style={{
                opacity: m.opacity,
                transform: m.transform,
                width: '100%',
                maxWidth: 760,
                textAlign: 'center',
                background: barBg,
                border: `3px solid ${theme.accent}`,
                padding: '14px 20px',
                marginTop: i === 0 ? 0 : 10,
                fontFamily: theme.fontHeading,
                fontWeight: 800,
                fontSize: 40 * theme.fontScale,
                letterSpacing: '0.02em',
                color: barColor,
                textTransform: 'uppercase',
              }}
            >
              <Line
                text={ln.text}
                t={t}
                start={start}
                end={dur}
                size={40}
                weight={800}
                align="center"
                color={barColor}
                theme={theme}
              />
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

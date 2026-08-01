import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Chrome } from '../shared/Chrome';
import { Line } from '../shared/Line';
import { BrollBackground } from '../shared/BrollBackground';
import { SceneVideo } from '../shared/SceneVideo';
import { draw } from '../shared/motion';
import { sceneCaptionText } from '../shared/caption';
import type { SceneComponentProps } from '../shared/sceneProps';

const MAX_BAR_WIDTH = 640;

// Animated horizontal comparison bars — port of the reference's `Compare` beat. Each row's
// `value` (0..1) is scaled to a fixed max bar width, drawn in staggered 0.5s apart.
export function CompareScene({ scene, theme, t, dur, label, showCaptions, showTimecode, sceneIndex, sceneCount, elapsedSec, totalSec, video }: SceneComponentProps) {
  const rows = scene.compareRows || [];
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
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        {scene.kicker && (
          <Line text={scene.kicker} t={t} start={0} end={dur} size={40} weight={theme.headingWeight} align="center" marginBottom={12} color={theme.ink} theme={theme} />
        )}
        {rows.map((r, i) => {
          const p = draw(t, 0.3 + i * 0.5, 0.9 + i * 0.5);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20, width: 800 }}>
              <div
                style={{
                  width: 220,
                  fontFamily: theme.fontHeading,
                  fontWeight: theme.headingWeight,
                  fontSize: 22 * theme.fontScale,
                  textAlign: 'right',
                  color: r.accent ? theme.accentDeep : theme.ink,
                }}
              >
                {r.label}
              </div>
              <div style={{ flex: 1, position: 'relative', height: 20 }}>
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: MAX_BAR_WIDTH * r.value * p,
                    background: r.accent ? theme.accent : theme.dark ? theme.bg : '#8a8580',
                  }}
                />
              </div>
              <div style={{ width: 90, fontFamily: theme.fontHeading, fontWeight: 800, fontSize: 18 * theme.fontScale, color: theme.ink, opacity: 0.72 }}>{r.sub}</div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

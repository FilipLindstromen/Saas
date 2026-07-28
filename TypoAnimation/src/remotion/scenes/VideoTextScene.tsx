import React from 'react';
import { AbsoluteFill, OffthreadVideo } from 'remotion';
import { Chrome } from '../shared/Chrome';
import { Line } from '../shared/Line';
import { enter } from '../shared/motion';
import { sceneCaptionText } from '../shared/caption';
import type { ResolvedSceneTheme } from '../shared/theme';
import type { BrollAsset } from '@/types/project';
import type { SceneComponentProps } from '../shared/sceneProps';

// A headline line filled with the scene's own b-roll footage instead of a flat color: the
// video paints only where this line's glyphs are opaque, via `mix-blend-mode: destination-in`
// compositing the (always-on-top, always-opaque) text against the video underneath it in an
// isolated stacking context — a pure-CSS video-clipped-to-text mask, no canvas/SVG measuring
// needed. Falls back to a normal ink-colored line when the scene has no b-roll attached.
function VideoMaskedLine({
  text,
  t,
  start,
  end,
  size,
  theme,
  broll,
}: {
  text: string;
  t: number;
  start: number;
  end: number;
  size: number;
  theme: ResolvedSceneTheme;
  broll?: BrollAsset;
}) {
  const m = enter(t, { start, end, inDur: 0.32, outDur: 0.2, rise: 46 });
  const textStyle: React.CSSProperties = {
    fontFamily: theme.fontHeading,
    fontWeight: theme.headingWeight,
    fontSize: size,
    lineHeight: 0.98,
    letterSpacing: '-0.02em',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  };

  if (!broll) {
    return (
      <div style={{ opacity: m.opacity, transform: m.transform, filter: m.filter, color: theme.ink, ...textStyle }}>
        {text}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', isolation: 'isolate', opacity: m.opacity, transform: m.transform, filter: m.filter }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <OffthreadVideo src={broll.path} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ position: 'relative', mixBlendMode: 'destination-in', color: '#000', ...textStyle }}>{text}</div>
    </div>
  );
}

export function VideoTextScene({ scene, theme, t, dur, label, showCaptions, showTimecode, sceneIndex, sceneCount, elapsedSec, totalSec }: SceneComponentProps) {
  const lineStart = 0.08;
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
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 32px', gap: 8 }}>
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
            marginBottom={6}
            theme={theme}
          />
        )}
        {scene.lines.map((ln, i) => (
          <VideoMaskedLine key={i} text={ln.text} t={t} start={lineStart + i * 0.2} end={dur} size={104} theme={theme} broll={scene.broll} />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

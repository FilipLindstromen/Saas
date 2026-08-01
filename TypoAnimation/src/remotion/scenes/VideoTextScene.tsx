import React from 'react';
import { AbsoluteFill, OffthreadVideo } from 'remotion';
import { Chrome } from '../shared/Chrome';
import { Line } from '../shared/Line';
import { enter } from '../shared/motion';
import { sceneCaptionText } from '../shared/caption';
import type { ResolvedSceneTheme } from '../shared/theme';
import type { BrollAsset } from '@/types/project';
import type { SceneComponentProps } from '../shared/sceneProps';

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Matches the maxWidth convention other scene styles use for centered headline text
// (PosterScene, PlainScene) — the 1080-wide square composition leaves this much room either
// side of center before clipping.
const MASK_W = 980;

// A headline line filled with the scene's own b-roll footage instead of a flat color: an
// inline SVG <text> (matching the line's font/size/weight, so it's an exact glyph match, not
// an HTML-layout approximation) is used as a `mask-image` on the video, so only the pixels
// under the letterforms are visible — a real clip, not a blend/tint. `destination-in` is
// tempting but wrong here: that's a canvas/SVG compositing operator, not a valid
// `mix-blend-mode` value, so the browser would silently drop it and show nothing. Falls back
// to a normal ink-colored line when the scene has no b-roll attached.
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
  const scaledSize = size * theme.fontScale;
  const textStyle: React.CSSProperties = {
    fontFamily: theme.fontHeading,
    fontWeight: theme.headingWeight,
    fontSize: scaledSize,
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

  const maskHeight = Math.round(scaledSize * 1.3);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${MASK_W}' height='${maskHeight}'>` +
    `<text x='50%' y='50%' dominant-baseline='central' text-anchor='middle' ` +
    `font-family='${theme.fontHeading}' font-weight='${theme.headingWeight}' font-size='${scaledSize}' ` +
    `letter-spacing='-2' fill='white'>${escapeXml(text)}</text></svg>`;
  const maskImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  const maskProps: React.CSSProperties = {
    WebkitMaskImage: maskImage,
    maskImage,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
  };

  return (
    <div style={{ opacity: m.opacity, transform: m.transform, filter: m.filter, width: MASK_W, height: maskHeight, ...maskProps }}>
      <OffthreadVideo src={broll.path} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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

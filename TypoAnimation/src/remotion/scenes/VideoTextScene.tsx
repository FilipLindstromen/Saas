import React, { useId } from 'react';
import { AbsoluteFill, Img } from 'remotion';
import { Chrome } from '../shared/Chrome';
import { Line } from '../shared/Line';
import { SceneBackdrop } from '../shared/SceneBackdrop';
import { enter } from '../shared/motion';
import { sceneCaptionText } from '../shared/caption';
import type { ResolvedSceneTheme } from '../shared/theme';
import { stripInlineHighlightMarkup } from '@/lib/inlineHighlight';
import type { BrollAsset } from '@/types/project';
import type { SceneComponentProps } from '../shared/sceneProps';
import { brollMediaKind } from '../shared/mediaSrc';
import { brollMediaStyle } from '../shared/brollFraming';
import { RemotionVideo } from '../shared/RemotionVideo';
import { useBrollSrc } from '../shared/useBrollSrc';

const MASK_W = 980;

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
  const maskId = useId().replace(/:/g, '');
  const m = enter(t, { start, end, inDur: 0.32, outDur: 0.2, rise: 46 });
  const scaledSize = size * theme.fontScale;
  const plain = stripInlineHighlightMarkup(text);
  const binding = useBrollSrc(broll);

  const textStyle: React.CSSProperties = {
    fontFamily: theme.fontHeading,
    fontWeight: theme.headingWeight,
    fontSize: scaledSize,
    lineHeight: 0.98,
    letterSpacing: '-0.02em',
    textAlign: 'center',
    whiteSpace: 'pre-wrap',
    maxWidth: MASK_W,
  };

  if (!broll?.path || !binding) {
    return (
      <div style={{ opacity: m.opacity, transform: m.transform, filter: m.filter, color: theme.ink, ...textStyle }}>
        {plain}
      </div>
    );
  }

  const maskHeight = Math.round(scaledSize * 1.45);
  const kind = brollMediaKind(broll);
  const mediaStyle: React.CSSProperties = {
    ...brollMediaStyle(broll),
    width: '100%',
    height: '100%',
    minWidth: MASK_W,
    minHeight: maskHeight,
  };

  return (
    <div
      style={{
        opacity: m.opacity,
        transform: m.transform,
        filter: m.filter,
        position: 'relative',
        width: '100%',
        maxWidth: MASK_W,
        height: maskHeight,
        margin: '0 auto',
      }}
    >
      <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
        <defs>
          <mask
            id={maskId}
            maskUnits="userSpaceOnUse"
            x={0}
            y={0}
            width={MASK_W}
            height={maskHeight}
          >
            <rect width={MASK_W} height={maskHeight} fill="black" />
            <text
              x="50%"
              y="50%"
              dominantBaseline="central"
              textAnchor="middle"
              fill="white"
              fontFamily={theme.fontHeading}
              fontWeight={theme.headingWeight}
              fontSize={scaledSize}
              letterSpacing="-0.02em"
            >
              {plain}
            </text>
          </mask>
        </defs>
      </svg>
      <div
        style={{
          width: MASK_W,
          height: maskHeight,
          margin: '0 auto',
          WebkitMaskImage: `url(#${maskId})`,
          maskImage: `url(#${maskId})`,
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskSize: `${MASK_W}px ${maskHeight}px`,
          maskSize: `${MASK_W}px ${maskHeight}px`,
          overflow: 'hidden',
        }}
      >
        {kind === 'image' ? (
          <Img src={binding.src} onError={binding.onError} style={mediaStyle} />
        ) : (
          <RemotionVideo src={binding.src} muted onError={binding.onError} style={mediaStyle} />
        )}
      </div>
    </div>
  );
}

export function VideoTextScene({
  scene,
  theme,
  t,
  dur,
  label,
  showCaptions,
  showTimecode,
  sceneIndex,
  sceneCount,
  elapsedSec,
  totalSec,
  video,
}: SceneComponentProps) {
  const lineStart = 0.08;
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
          <VideoMaskedLine
            key={i}
            text={ln.text}
            t={t}
            start={lineStart + i * 0.2}
            end={dur}
            size={104}
            theme={theme}
            broll={scene.broll}
          />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

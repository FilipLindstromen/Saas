import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Chrome } from '../shared/Chrome';
import { Line } from '../shared/Line';
import { SceneBackdrop } from '../shared/SceneBackdrop';
import { sceneCaptionText } from '../shared/caption';
import { animate, Easing } from '../shared/motion';
import type { SceneComponentProps } from '../shared/sceneProps';

const SLOT_DISTANCE = 60;

interface SlotTiming {
  start: number;
  slotDur: number;
}

function layoutSlots(words: string[], dur: number): SlotTiming[] {
  const slotDur = dur / Math.max(1, words.length);
  return words.map((_, i) => ({ start: i * slotDur, slotDur }));
}

function slotMotion(t: number, { start, slotDur }: SlotTiming) {
  const transDur = Math.min(0.3, slotDur * 0.35);
  const holdEnd = start + slotDur - transDur;
  if (t <= start + transDur) {
    const p = animate(t, { from: 0, to: 1, start, end: start + transDur, ease: Easing.easeOutCubic });
    return { opacity: p, y: SLOT_DISTANCE * (1 - p) };
  }
  if (t <= holdEnd) return { opacity: 1, y: 0 };
  const p = animate(t, { from: 0, to: 1, start: holdEnd, end: start + slotDur, ease: Easing.easeInCubic });
  return { opacity: 1 - p, y: -SLOT_DISTANCE * p };
}

function defaultRotatingWords(scene: SceneComponentProps['scene']): string[] {
  const fromField = (scene.rotatingWords || []).map((w) => w.trim()).filter(Boolean);
  if (fromField.length) return fromField;
  const fromLastLine = scene.lines[scene.lines.length - 1]?.text
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (fromLastLine?.length) return fromLastLine;
  return ['word'];
}

export function RotatingWordScene({
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
  const words = defaultRotatingWords(scene);
  const layout = layoutSlots(words, dur);

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
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 36px', gap: 4 }}>
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
            start={0.05 + i * 0.1}
            end={dur}
            size={60}
            align="center"
            color={theme.ink}
            theme={theme}
          />
        ))}
        <div
          style={{
            position: 'relative',
            height: 120,
            width: '100%',
            maxWidth: 980,
            marginTop: 8,
          }}
        >
          {words.map((w, i) => {
            const { opacity, y } = slotMotion(t, layout[i]);
            if (opacity <= 0.01) return null;
            return (
              <div
                key={`${i}-${w}`}
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity,
                  transform: `translateY(${y}px)`,
                  pointerEvents: 'none',
                }}
              >
                <Line
                  text={w}
                  t={t}
                  start={layout[i].start}
                  end={dur}
                  size={88}
                  weight={800}
                  marker
                  align="center"
                  color={theme.ink}
                  theme={theme}
                />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

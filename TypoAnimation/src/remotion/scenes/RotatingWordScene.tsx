import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Chrome } from '../shared/Chrome';
import { Line } from '../shared/Line';
import { BrollBackground } from '../shared/BrollBackground';
import { SceneVideo } from '../shared/SceneVideo';
import { sceneCaptionText } from '../shared/caption';
import { animate, Easing } from '../shared/motion';
import type { SceneComponentProps } from '../shared/sceneProps';

const SLOT_DISTANCE = 60;

interface SlotTiming {
  start: number;
  slotDur: number;
}

// Splits the scene's duration evenly across the rotating words, one slot each.
function layoutSlots(words: string[], dur: number): SlotTiming[] {
  const slotDur = dur / Math.max(1, words.length);
  return words.map((_, i) => ({ start: i * slotDur, slotDur }));
}

// Odometer-style handoff: each word slides up from below while fading in, holds in place,
// then continues sliding up while fading out as the next word takes over — the mirror image
// of FallingLinesScene's top-down fall, giving the two "sequential line" styles a distinct feel.
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

// A static prefix line, then a single word/phrase slot that cycles through `rotatingWords` —
// each one sliding up into place, holding long enough to read, then sliding on through as the
// next takes over. Good for feature-list or "we are ___" beats.
export function RotatingWordScene({ scene, theme, t, dur, label, showCaptions, showTimecode, sceneIndex, sceneCount, elapsedSec, totalSec, video }: SceneComponentProps) {
  const words = scene.rotatingWords && scene.rotatingWords.length ? scene.rotatingWords : [''];
  const layout = layoutSlots(words, dur);
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
          <Line key={i} text={ln.text} t={t} start={0.05 + i * 0.1} end={dur} size={60} align="center" color={theme.ink} theme={theme} />
        ))}
        <div style={{ position: 'relative', height: 100, width: '100%', marginTop: 8 }}>
          {words.map((w, i) => {
            const { opacity, y } = slotMotion(t, layout[i]);
            if (opacity <= 0 || !w) return null;
            return (
              <AbsoluteFill key={i} style={{ alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ opacity, transform: `translateY(${y}px)` }}>
                  <Line text={w} t={t} start={-Infinity} end={Infinity} size={88} weight={800} marker align="center" color={theme.ink} theme={theme} />
                </div>
              </AbsoluteFill>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

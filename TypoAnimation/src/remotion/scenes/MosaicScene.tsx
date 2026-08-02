import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import { Chrome } from '../shared/Chrome';
import { SceneBackdrop } from '../shared/SceneBackdrop';
import { enter, pop } from '../shared/motion';
import { sceneCaptionText } from '../shared/caption';
import type { SceneComponentProps } from '../shared/sceneProps';

import { tokenizeInlineHighlightWords } from '@/lib/inlineHighlight';

interface MosaicWord {
  text: string;
  accent?: boolean;
}

// Flattens every scene.line into its own words (not one chunk per line) — a line marked
// `accent` (via the ">" prefix) makes ALL of its words big; everything else stays small. This
// is what actually makes it a word-by-word collage regardless of whether the input was typed
// one-word-per-line or as full sentences.
function flattenWords(lines: { text: string; accent?: boolean }[]): MosaicWord[] {
  const out: MosaicWord[] = [];
  for (const ln of lines) {
    for (const w of tokenizeInlineHighlightWords(ln.text)) {
      out.push({ text: w.word, accent: ln.accent || w.highlighted });
    }
  }
  return out;
}

// A tightly-packed word collage — some words huge and accent-colored, others small and
// ink-colored, wrapping edge-to-edge like a kinetic-typography poster (think "creative pack"
// ad templates: a wall of mixed-size uppercase words, no boxes, just scale and color doing the
// emphasis). Mark a line ">" (accent) to make all of its words the big ones.
export function MosaicScene({ scene, theme, t, dur, label, showCaptions, showTimecode, sceneIndex, sceneCount, elapsedSec, totalSec, video }: SceneComponentProps) {
  const words = useMemo(() => flattenWords(scene.lines), [scene.lines]);

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
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '64px 48px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignContent: 'center', justifyContent: 'center', gap: '0.08em 0.22em', maxWidth: 980 }}>
          {words.map((w, i) => {
            const start = 0.05 + i * 0.045;
            const m = enter(t, { start, end: dur, inDur: 0.22, outDur: 0.14, rise: 26, rot: w.accent ? 6 : -4 });
            const p = pop(t, start, { amount: w.accent ? 0.2 : 0.08 });
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  opacity: m.opacity,
                  transform: `${m.transform} scale(${p})`,
                  fontFamily: theme.fontHeading,
                  fontWeight: w.accent ? 900 : 700,
                  fontSize: (w.accent ? 108 : 46) * theme.fontScale,
                  lineHeight: 0.96,
                  letterSpacing: '-0.01em',
                  textTransform: 'uppercase',
                  color: w.accent ? theme.accent : theme.ink,
                }}
              >
                {w.text}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

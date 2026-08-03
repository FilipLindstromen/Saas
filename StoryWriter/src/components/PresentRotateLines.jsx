import { applyHeadlineToLineText } from '../utils/lineReveal';
import { getExitAnimation, presentationTimingStyle } from '../utils/textAnimations';
import { PresentTextParts } from './PresentTextParts';

export default function PresentRotateLines({
  rows,
  styledParts,
  fontSize,
  lineHeight,
  animKey,
  phase = 'idle',
  animation = 'slide-up',
  rules,
}) {
  if (!rows?.length) return null;

  const hasBullets = rows.some((row) => row.kind === 'line' && row.variant === 'bullet');
  const exitAnimation = phase === 'exit' ? getExitAnimation(animation) : animation;
  const timingStyle = presentationTimingStyle(rules);
  const staggerMs = rules?.wordStaggerMs ?? 70;
  let lineOutIndex = 0;

  return (
    <div
      className={[
        'present-rotate',
        hasBullets && 'present-rotate--bullets',
        phase === 'enter' && 'present-rotate--phase-enter',
        phase === 'exit' && 'present-rotate--phase-exit',
        phase === 'idle' && 'present-rotate--phase-idle',
        phase === 'exit' && `present-rotate--exit-${exitAnimation}`,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ fontSize, lineHeight, ...timingStyle }}
      aria-live="polite"
    >
      {rows.map((row, index) => {
        if (row.kind === 'static') {
          return (
            <p key={`s-${index}`} className="present-rotate__static">
              {row.text}
            </p>
          );
        }
        const parts = applyHeadlineToLineText(row.text, styledParts);
        const animate = row.animate && phase !== 'exit';
        const isBullet = row.variant === 'bullet';
        const outStagger = phase === 'exit' ? lineOutIndex++ * staggerMs : 0;
        const inStagger = animate && phase !== 'exit' ? row.staggerInMs ?? 0 : 0;
        const delayStyle =
          phase === 'exit'
            ? { animationDelay: `${outStagger}ms` }
            : inStagger
              ? { animationDelay: `${inStagger}ms` }
              : undefined;
        const stableKey = `l-${index}-${isBullet ? 'b' : 'r'}`;
        return (
          <div
            key={phase === 'exit' ? stableKey : `${stableKey}-${animKey}`}
            className={[
              'present-rotate__mask',
              isBullet && 'present-rotate__mask--bullet',
              animate && 'present-rotate__mask--animate',
              isBullet && animate && 'present-rotate__mask--animate-bullet',
              !isBullet && animate && 'present-rotate__mask--animate-rotate',
              phase === 'exit' && 'present-rotate__mask--exit',
            ]
              .filter(Boolean)
              .join(' ')}
            style={delayStyle}
          >
            <div
              className={[
                'present-rotate__line',
                isBullet && 'present-rotate__line--bullet',
                phase === 'exit' && 'present-rotate__line--out',
                phase === 'exit' && isBullet && 'present-rotate__line--out-bullet',
              ]
                .filter(Boolean)
                .join(' ')}
              style={delayStyle}
            >
              <PresentTextParts parts={parts} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

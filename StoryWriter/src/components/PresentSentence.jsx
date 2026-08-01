import { useMemo } from 'react';
import { splitSentenceWords, getExitAnimation } from '../utils/textAnimations';

export default function PresentSentence({ text, animation, phase = 'enter', rules, style }) {
  const words = useMemo(() => splitSentenceWords(text), [text]);
  const exitAnimation = phase === 'exit' ? getExitAnimation(animation) : animation;
  const motionClass = phase === 'exit' ? exitAnimation : animation;

  const className = [
    'present-view__sentence',
    `present-view__sentence--${motionClass}`,
    phase === 'enter' && 'present-view__sentence--enter',
    phase === 'exit' && 'present-view__sentence--exit',
    phase === 'idle' && 'present-view__sentence--idle',
  ]
    .filter(Boolean)
    .join(' ');

  if (animation === 'fade-words') {
    const stagger = rules?.wordStaggerMs ?? 70;
    return (
      <div className={`${className} present-view__sentence--fade-words`} style={style} aria-live="polite">
        <span className="present-view__word-line">
          {words.map((word, i) => (
            <span
              key={`${word}-${i}`}
              className={[
                'present-view__word',
                phase !== 'enter' && 'present-view__word--visible',
                phase === 'exit' && 'present-view__word--out',
              ]
                .filter(Boolean)
                .join(' ')}
              style={
                phase === 'enter'
                  ? { animationDelay: `${i * stagger}ms` }
                  : phase === 'exit'
                    ? { animationDelay: `${(words.length - 1 - i) * stagger}ms` }
                    : undefined
              }
            >
              {word}
              {i < words.length - 1 ? ' ' : ''}
            </span>
          ))}
        </span>
      </div>
    );
  }

  return (
    <div className={className} style={style} aria-live="polite">
      {text}
    </div>
  );
}

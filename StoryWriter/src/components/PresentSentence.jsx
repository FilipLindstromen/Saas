import { useMemo } from 'react';
import { splitSentenceWords, getExitAnimation } from '../utils/textAnimations';

export default function PresentSentence({ text, animation, phase = 'enter', rules, style }) {
  const words = useMemo(() => splitSentenceWords(text), [text]);
  const exitAnimation = phase === 'exit' ? getExitAnimation(animation) : animation;

  const className = [
    'present-view__sentence',
    `present-view__sentence--${exitAnimation}`,
    phase === 'enter' && 'present-view__sentence--enter',
    phase === 'exit' && 'present-view__sentence--exit',
    phase === 'idle' && 'present-view__sentence--idle',
  ]
    .filter(Boolean)
    .join(' ');

  if (animation === 'fade-words' && phase !== 'exit') {
    const stagger = rules?.wordStaggerMs ?? 70;
    return (
      <div className={className} style={style} aria-live="polite">
        {words.map((word, i) => (
          <span
            key={`${word}-${i}`}
            className={`present-view__word${phase === 'idle' ? ' present-view__word--visible' : ''}`}
            style={phase === 'enter' ? { animationDelay: `${i * stagger}ms` } : undefined}
          >
            {word}
            {i < words.length - 1 ? '\u00A0' : ''}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={className} style={style} aria-live="polite">
      {text}
    </div>
  );
}

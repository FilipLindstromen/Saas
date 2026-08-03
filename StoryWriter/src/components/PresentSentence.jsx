import { useMemo } from 'react';
import { splitSentenceWords, getExitAnimation } from '../utils/textAnimations';

function FadeWordsContent({ text, phase, stagger }) {
  const lines = useMemo(() => String(text).split('\n'), [text]);

  let wordIndex = 0;

  return (
    <span className="present-view__word-line-wrap">
      {lines.map((line, lineIndex) => {
        const words = splitSentenceWords(line);
        if (words.length === 0) {
          return (
            <span
              key={`blank-${lineIndex}`}
              className="present-view__word-line present-view__word-line--blank"
              aria-hidden="true"
            >
              {'\u00A0'}
            </span>
          );
        }
        return (
          <span key={`line-${lineIndex}`} className="present-view__word-line">
            {words.map((word) => {
              const i = wordIndex;
              wordIndex += 1;
              return (
                <span
                  key={`${lineIndex}-${i}-${word}`}
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
                        ? { animationDelay: `${i * stagger}ms` }
                        : undefined
                  }
                >
                  {word}
                  {' '}
                </span>
              );
            })}
          </span>
        );
      })}
    </span>
  );
}

export default function PresentSentence({ text, animation, phase = 'enter', rules, style }) {
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

  const mergedStyle = { ...style, whiteSpace: 'pre-line' };

  if (animation === 'fade-words') {
    const stagger = rules?.wordStaggerMs ?? 70;
    return (
      <div className={`${className} present-view__sentence--fade-words`} style={mergedStyle} aria-live="polite">
        <FadeWordsContent text={text} phase={phase} stagger={stagger} />
      </div>
    );
  }

  return (
    <div className={className} style={mergedStyle} aria-live="polite">
      {text}
    </div>
  );
}

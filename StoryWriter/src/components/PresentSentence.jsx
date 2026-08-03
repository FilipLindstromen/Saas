import { useMemo } from 'react';
import { splitSentenceWords, getExitAnimation, presentationTimingStyle } from '../utils/textAnimations';

function FadeWordsStyledParts({ parts, phase, stagger, headlineScale }) {
  let wordIndex = 0;
  return (
    <span className="present-view__word-line-wrap">
      {parts.map((part, partIndex) => {
        const lines = String(part.text).split('\n');
        return lines.map((line, lineIndex) => {
          const words = splitSentenceWords(line);
          if (words.length === 0) {
            return (
              <span
                key={`${partIndex}-${lineIndex}-blank`}
                className="present-view__word-line present-view__word-line--blank"
                aria-hidden="true"
              >
                {'\u00A0'}
              </span>
            );
          }
          return (
            <span
              key={`${partIndex}-${lineIndex}`}
              className={[
                'present-view__word-line',
                part.headline && 'present-view__word-line--headline',
              ]
                .filter(Boolean)
                .join(' ')}
              style={part.headline ? { fontSize: headlineScale } : undefined}
            >
              {words.map((word) => {
                const i = wordIndex;
                wordIndex += 1;
                return (
                  <span
                    key={`${partIndex}-${lineIndex}-${i}-${word}`}
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
        });
      })}
    </span>
  );
}

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

function StyledInlineParts({ parts }) {
  return parts.map((part, i) =>
    part.headline ? (
      <span key={i} className="present-view__headline">
        {part.text}
      </span>
    ) : (
      <span key={i}>{part.text}</span>
    )
  );
}

export default function PresentSentence({
  text,
  styledParts,
  animation,
  phase = 'enter',
  rules,
  style,
}) {
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

  const mergedStyle = {
    ...presentationTimingStyle(rules),
    ...style,
    whiteSpace: 'pre-line',
  };
  const parts = styledParts?.length ? styledParts : null;
  const headlineScale = '1.45em';

  if (animation === 'fade-words') {
    const stagger = rules?.wordStaggerMs ?? 70;
    return (
      <div className={`${className} present-view__sentence--fade-words`} style={mergedStyle} aria-live="polite">
        {parts ? (
          <FadeWordsStyledParts parts={parts} phase={phase} stagger={stagger} headlineScale={headlineScale} />
        ) : (
          <FadeWordsContent text={text} phase={phase} stagger={stagger} />
        )}
      </div>
    );
  }

  return (
    <div className={className} style={mergedStyle} aria-live="polite">
      {parts ? <StyledInlineParts parts={parts} /> : text}
    </div>
  );
}

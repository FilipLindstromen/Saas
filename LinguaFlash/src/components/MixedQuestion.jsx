import { useEffect, useMemo, useState } from 'react';
import { shuffleArray } from '../lib/parse';

export default function MixedQuestion({ pairs, pairIndex, accentColor, tinted, isPlaying, onComplete, language = 'en' }) {
  const [selected, setSelected] = useState(null);
  const options = useMemo(() => shuffleArray([
    pairIndex,
    ...shuffleArray(pairs.map((_, i) => i).filter(i => i !== pairIndex)).slice(0, 3),
  ]), [pairs, pairIndex]);

  useEffect(() => {
    if (selected === null || !isPlaying) return undefined;
    const timer = setTimeout(onComplete, 900);
    return () => clearTimeout(timer);
  }, [selected, isPlaying, onComplete]);

  return (
    <div className="quiz-screen">
      <div className={`quiz-prompt ${tinted ? 'quiz-prompt--tinted' : ''}`}
        style={tinted ? { backgroundColor: accentColor } : undefined}>
        <div className="quiz-lang-tag">Multiple choice · SV</div>
        <div className="quiz-word" style={!tinted ? { color: accentColor } : undefined}>
          {pairs[pairIndex].sv}
        </div>
      </div>
      <div className="quiz-options">
        {options.map(i => (
          <button key={i} type="button" lang={language}
            className={`quiz-option ${selected === null ? '' : i === pairIndex ? 'quiz-option--correct' : i === selected ? 'quiz-option--wrong' : ''}`}
            disabled={!isPlaying || selected !== null}
            onClick={() => setSelected(i)}>
            {pairs[i].en}
          </button>
        ))}
      </div>
    </div>
  );
}

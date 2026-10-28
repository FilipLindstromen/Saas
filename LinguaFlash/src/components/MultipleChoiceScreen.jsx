import { useEffect, useMemo, useRef, useState } from 'react';
import { parseText, shuffleArray } from '../lib/parse';
import { generateWordBasedColors, LANGUAGE_COLORS, mutedBackground } from '../lib/colors';
import { formatSeconds } from '../lib/format';
import { useCountdown } from '../hooks/useCountdown';

const MAX_OPTIONS = 4;
const FEEDBACK_DELAY_MS = 900;

function freshQueue(count) {
  return shuffleArray(Array.from({ length: count }, (_, i) => i));
}

export default function MultipleChoiceScreen({ rawText, colorMode, sessionMinutes, onBack, separator, language = 'en' }) {
  const { pairs } = useMemo(() => parseText(rawText, separator), [rawText, separator]);
  const bgColors = useMemo(() => generateWordBasedColors(pairs.length), [pairs.length]);

  const [queue, setQueue] = useState(() => freshQueue(pairs.length));
  const [queuePos, setQueuePos] = useState(0);
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const advanceTimerRef = useRef(null);

  const totalSeconds = sessionMinutes ? sessionMinutes * 60 : null;
  const countdown = useCountdown(totalSeconds, started && !finished);

  useEffect(() => {
    if (countdown.expired) setFinished(true);
  }, [countdown.expired]);

  useEffect(() => () => clearTimeout(advanceTimerRef.current), []);

  const currentPairIndex = pairs.length > 0 ? queue[queuePos % queue.length] : null;
  const currentPair = currentPairIndex !== null ? pairs[currentPairIndex] : null;

  useEffect(() => {
    if (currentPairIndex === null || pairs.length < 2) return;
    const distractorPool = pairs.map((_, i) => i).filter((i) => i !== currentPairIndex);
    const distractors = shuffleArray(distractorPool).slice(0, Math.min(MAX_OPTIONS - 1, distractorPool.length));
    setOptions(shuffleArray([currentPairIndex, ...distractors]));
    setSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPairIndex]);

  const isBg = colorMode === 'colorBg';
  const accentColor = currentPairIndex !== null ? bgColors[currentPairIndex] ?? LANGUAGE_COLORS.sv : LANGUAGE_COLORS.sv;

  const advance = () => {
    const next = queuePos + 1;
    if (next >= queue.length) {
      if (sessionMinutes) {
        setQueue(freshQueue(pairs.length));
        setQueuePos(0);
      } else {
        setFinished(true);
      }
    } else {
      setQueuePos(next);
    }
  };

  const handleSelect = (optionPairIndex) => {
    if (selected !== null || finished) return;
    setStarted(true);
    setSelected(optionPairIndex);
    const isCorrect = optionPairIndex === currentPairIndex;
    setScore((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
    advanceTimerRef.current = setTimeout(advance, FEEDBACK_DELAY_MS);
  };

  const handleRestart = () => {
    clearTimeout(advanceTimerRef.current);
    setQueue(freshQueue(pairs.length));
    setQueuePos(0);
    setScore({ correct: 0, total: 0 });
    setSelected(null);
    setStarted(false);
    setFinished(false);
    countdown.reset();
  };

  if (pairs.length < 2) {
    return (
      <div className="quiz-screen">
        <div className="quiz-empty">Add at least 2 pairs to use multiple choice.</div>
        <div className="quiz-footer">
          <div className="button-row">
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              Edit text
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-screen">
      {finished ? (
        <div className="quiz-empty">
          {countdown.expired ? "Time's up! " : 'Session complete! '}
          Score {score.correct}/{score.total}. Press restart to go again.
        </div>
      ) : (
        <>
          <div
            className={`quiz-prompt ${isBg ? 'quiz-prompt--tinted' : ''}`}
            style={isBg ? { backgroundColor: mutedBackground(accentColor) } : undefined}
          >
            <div className="quiz-lang-tag">SV</div>
            <div className="quiz-word" style={!isBg ? { color: accentColor } : undefined}>
              {currentPair.sv}
            </div>
          </div>

          <div className="quiz-options">
            {options.map((optionPairIndex) => {
              const isCorrectOption = optionPairIndex === currentPairIndex;
              const isSelectedOption = optionPairIndex === selected;
              let stateClass = '';
              if (selected !== null) {
                if (isCorrectOption) stateClass = 'quiz-option--correct';
                else if (isSelectedOption) stateClass = 'quiz-option--wrong';
              }
              return (
                <button
                  key={optionPairIndex}
                  lang={language}
                  type="button"
                  className={`quiz-option ${stateClass}`}
                  disabled={selected !== null}
                  onClick={() => handleSelect(optionPairIndex)}
                >
                  {pairs[optionPairIndex].en}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="quiz-footer">
        <div className="progress-text">
          Pair {currentPairIndex !== null ? currentPairIndex + 1 : 0} / {pairs.length}
          {' · '}Score {score.correct}/{score.total}
          {sessionMinutes
            ? ` · ${countdown.expired ? "Time's up" : formatSeconds(countdown.secondsLeft)}`
            : ''}
        </div>
        <div className="button-row">
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            Edit text
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleRestart}>
            Restart
          </button>
        </div>
      </div>
    </div>
  );
}

import { useMemo } from 'react';
import { parseText } from '../lib/parse';

const SAMPLE = `hus - house
bil - car
jag bor i ett hus - I live in a house
hund - dog
katt - cat
jag har en hund och en katt - I have a dog and a cat
äpple - apple
vatten - water`;

const PLAY_MODES = [
  { id: 'flash', label: 'Flash' },
  { id: 'multipleChoice', label: 'Multiple choice' },
];

const SESSION_OPTIONS = [
  { id: null, label: 'Full list' },
  { id: 1, label: '1 min' },
  { id: 2, label: '2 min' },
  { id: 3, label: '3 min' },
  { id: 4, label: '4 min' },
  { id: 5, label: '5 min' },
];

export default function TextInputScreen({
  rawText,
  setRawText,
  playMode,
  setPlayMode,
  sessionMinutes,
  setSessionMinutes,
  onStart,
}) {
  const { pairs, skipped } = useMemo(() => parseText(rawText), [rawText]);
  const needsMorePairs = playMode === 'multipleChoice' && pairs.length > 0 && pairs.length < 2;

  return (
    <div className="input-screen">
      <header>
        <h1 className="app-title">LinguaFlash</h1>
        <p className="app-subtitle">Rapid word-flash reading for Swedish &harr; English</p>
      </header>

      <details className="instructions">
        <summary>How to enter words</summary>
        <div className="instructions-body">
          <p>
            One pair per line: <code>svenska - english</code>
          </p>
          <p>Works for single words or full sentences — each line is learned as one unit:</p>
          <pre className="example">{'hus - house\njag bor i ett hus - I live in a house'}</pre>
        </div>
      </details>

      <textarea
        className="text-input"
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder={'hus - house\nbil - car'}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
      />

      <div className="input-meta">
        <button type="button" className="btn-link" onClick={() => setRawText(SAMPLE)}>
          Load example
        </button>

        <div className="parse-summary">
          {needsMorePairs
            ? 'Multiple choice needs at least 2 pairs'
            : `${pairs.length} pair${pairs.length === 1 ? '' : 's'} ready`}
          {skipped > 0 ? ` · ${skipped} line${skipped === 1 ? '' : 's'} skipped` : ''}
        </div>
      </div>

      <div className="setup-row">
        <span className="setup-label">Practice mode</span>
        <div className="chip-row" role="radiogroup" aria-label="Practice mode">
          {PLAY_MODES.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={playMode === opt.id}
              className={`chip ${playMode === opt.id ? 'chip-active' : ''}`}
              onClick={() => setPlayMode(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="setup-row">
        <span className="setup-label">Session length</span>
        <div className="chip-row" role="radiogroup" aria-label="Session length">
          {SESSION_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              role="radio"
              aria-checked={sessionMinutes === opt.id}
              className={`chip ${sessionMinutes === opt.id ? 'chip-active' : ''}`}
              onClick={() => setSessionMinutes(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {sessionMinutes && (
          <p className="setup-hint">
            The same words repeat in random order for {sessionMinutes} minute
            {sessionMinutes === 1 ? '' : 's'} of practice.
          </p>
        )}
      </div>

      <div className="start-bar">
        <button
          type="button"
          className="btn btn-play btn-block"
          disabled={pairs.length === 0 || needsMorePairs}
          onClick={onStart}
        >
          Start
        </button>
      </div>
    </div>
  );
}

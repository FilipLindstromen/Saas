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

const SPANISH_SAMPLE = `hus - casa
bil - coche
jag bor i ett hus - vivo en una casa
hund - perro
katt - gato
jag har en hund och en katt - tengo un perro y un gato
äpple - manzana
vatten - agua`;

const PLAY_MODES = [
  { id: 'flash', label: 'Flash' },
  { id: 'multipleChoice', label: 'Multiple choice' },
  { id: 'mixed', label: 'Mixed' },
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
  training,
  setTraining,
  separator,
  setSeparator,
  language,
  setLanguage,
}) {
  const languageName = language === 'es' ? 'Spanish' : 'English';
  const sample = language === 'es' ? SPANISH_SAMPLE : SAMPLE;
  const { pairs, skipped } = useMemo(() => parseText(rawText, separator), [rawText, separator]);
  const needsMorePairs = playMode !== 'flash' && pairs.length > 0 && pairs.length < 2;

  return (
    <div className="input-screen">
      <header>
        <h1 className="app-title">LinguaFlash</h1>
        <p className="app-subtitle">Rapid word-flash reading for Swedish &harr; {languageName}</p>
      </header>

      <div className="setup-row">
        <label className="setup-label" htmlFor="practice-language">Language to practice</label>
        <select id="practice-language" className="separator-input" value={language}
          onChange={event => setLanguage(event.target.value)}>
          <option value="en">English</option>
          <option value="es">Spanish</option>
        </select>
        <p className="setup-hint">Enter Swedish on the left and {languageName} on the right. Changing language keeps your text.</p>
      </div>

      <details className="instructions">
        <summary>How to enter words</summary>
        <div className="instructions-body">
          <p>
            One pair per line, separated by the exact text in the Separator field.
          </p>
          <p>Works for single words or full sentences — each line is learned as one unit:</p>
          <pre className="example">{sample.split('\n').slice(0, 3).join('\n').replaceAll(' - ', separator || ' - ')}</pre>
        </div>
      </details>

      <div className="setup-row">
        <label className="setup-label" htmlFor="pair-separator">Separator between Swedish and {languageName}</label>
        <input id="pair-separator" className="separator-input" type="text"
          value={separator} onChange={event => setSeparator(event.target.value)}
          spellCheck={false} autoCapitalize="off" autoCorrect="off"
          aria-describedby="separator-help" aria-invalid={separator.length === 0} />
        <p id="separator-help" className="setup-hint">
          Matches exactly, including spaces. Examples: <code>{' - '}</code>, <code>-</code>, <code>{', '}</code>.
          {!separator && ' Enter a separator to start.'}
        </p>
      </div>

      <textarea
        className="text-input"
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder={sample.split('\n').slice(0, 2).join('\n').replaceAll(' - ', separator || ' - ')}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
      />

      <div className="input-meta">
        <button type="button" className="btn-link" onClick={() => setRawText(sample.replaceAll(' - ', separator || ' - '))}>
          Load example
        </button>

        <div className="parse-summary">
          {needsMorePairs
            ? 'Multiple choice and Mixed need at least 2 pairs'
            : `${pairs.length} pair${pairs.length === 1 ? '' : 's'} ready`}
          {skipped > 0 ? ` · ${skipped} line${skipped === 1 ? '' : 's'} skipped` : ''}
        </div>
      </div>

      {playMode === 'mixed' && (
        <p className="setup-hint">Read three pairs, then answer one multiple-choice question.</p>
      )}

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

      {playMode !== 'multipleChoice' && (
        <div className="setup-row">
          <span className="setup-label">Reading exercises</span>
          <div className="chip-row" role="radiogroup" aria-label="Language order">
            {[[true, 'Swedish first'], [false, 'Swedish last']].map(([value, label]) => (
              <button key={label} type="button" role="radio"
                aria-checked={training.swedishFirst === value}
                className={`chip ${training.swedishFirst === value ? 'chip-active' : ''}`}
                onClick={() => setTraining(previous => ({ ...previous, swedishFirst: value }))}>
                {label}
              </button>
            ))}
          </div>
          {[
            ['pairFlash', 'Color flash between pairs', 'Briefly flash the completed pair’s color before the next pair. Independent of Color BG.'],
            ['recallGap', 'Recall gap', 'A blank 0.6-second pause between languages to recall the translation. Turns off the Swedish hint.'],
            ['phraseChunks', 'Phrase chunks', 'Read short groups of up to three words, split at punctuation and common phrase boundaries.'],
            ['repeatPairs', 'Repeat each pair 10 times', `Alternate the complete Swedish and ${languageName} word or sentence ten times before moving on. Uses your WPM setting; overrides phrase chunks.`],
            ['accelerate', 'Faster with each repetition', 'Each repetition is 10% quicker, resetting to the starting speed for the next pair. Requires repeat mode.'],
          ].map(([key, label, description]) => (
            <div key={key}>
              <button type="button" role="switch" aria-checked={training[key]}
                disabled={key === 'accelerate' && !training.repeatPairs}
                className="switch-row" onClick={() => setTraining(previous => ({ ...previous, [key]: !previous[key] }))}>
                <span>{label}</span>
                <span className="switch-track"><span className="switch-thumb" /></span>
              </button>
              <p className="setup-hint">{description}</p>
            </div>
          ))}
        </div>
      )}

      <div className="start-bar">
        <button
          type="button"
          className="btn btn-play btn-block"
          disabled={!separator || pairs.length === 0 || needsMorePairs}
          onClick={onStart}
        >
          Start
        </button>
      </div>
    </div>
  );
}

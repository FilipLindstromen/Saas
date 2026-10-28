const COLOR_MODES = [
  { id: 'language', label: 'Language' },
  { id: 'word', label: 'Word' },
  { id: 'wordSequence', label: 'Rainbow' },
  { id: 'colorBg', label: 'Color BG' },
];

const MIN_WPM = 100;
const MAX_WPM = 600;

export default function Controls({
  isPlaying,
  onPlayPause,
  onRestart,
  onBack,
  wpm,
  onWpmChange,
  colorMode,
  onColorModeChange,
  svHint,
  onSvHintChange,
  currentPairIndex,
  totalPairs,
  timeLabel,
}) {
  const wpmFill = ((wpm - MIN_WPM) / (MAX_WPM - MIN_WPM)) * 100;

  return (
    <div className="controls">
      <div className="controls-meta">
        <span>
          {totalPairs > 0 ? `Pair ${Math.min(currentPairIndex + 1, totalPairs)} / ${totalPairs}` : ''}
        </span>
        {timeLabel && <span className="controls-time">{timeLabel}</span>}
      </div>

      <div className="color-mode-row" role="radiogroup" aria-label="Color mode">
        {COLOR_MODES.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={colorMode === opt.id}
            className={`chip ${colorMode === opt.id ? 'chip-active' : ''}`}
            onClick={() => onColorModeChange(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={svHint}
        className="switch-row"
        onClick={() => onSvHintChange(!svHint)}
      >
        <span>Swedish hint above</span>
        <span className="switch-track">
          <span className="switch-thumb" />
        </span>
      </button>

      <div className="speed-row">
        <span className="speed-label">{wpm} WPM</span>
        <input
          type="range"
          min={MIN_WPM}
          max={MAX_WPM}
          step="10"
          value={wpm}
          onChange={(e) => onWpmChange(Number(e.target.value))}
          className="speed-slider"
          style={{ '--fill': `${wpmFill}%` }}
          aria-label="Reading speed in words per minute"
        />
      </div>

      <div className="button-row">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Edit text
        </button>
        <button type="button" className="btn btn-play" onClick={onPlayPause}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onRestart}>
          Restart
        </button>
      </div>
    </div>
  );
}

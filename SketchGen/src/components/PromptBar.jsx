import './PromptBar.css'

export default function PromptBar({ value, onChange, onGenerate, isGenerating, error, variations, onVariationsChange }) {
  return (
    <div className="prompt-bar-section">
      <h3 className="prompt-bar-title">Instructions (optional)</h3>
      <textarea
        className="prompt-bar-input"
        placeholder="e.g. make the cat orange, add a sunset background..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
      />

      <div className="prompt-bar-variations">
        <span>Variations</span>
        <div className="prompt-bar-variations-options">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              className={variations === n ? 'active' : ''}
              onClick={() => onVariationsChange(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="prompt-bar-error">{error}</div>}
      <button
        type="button"
        className="prompt-bar-generate"
        onClick={onGenerate}
        disabled={isGenerating}
      >
        {isGenerating ? 'Generating…' : variations > 1 ? `Generate ${variations} variations` : 'Generate'}
      </button>
    </div>
  )
}

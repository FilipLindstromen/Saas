import './PromptBar.css'

export default function PromptBar({
  value,
  onChange,
  onGenerate,
  isGenerating,
  error,
  variations,
  onVariationsChange,
  improveGeneration,
  onImproveGenerationChange,
  canImproveGeneration,
}) {
  return (
    <div className="prompt-bar-section side-panel">
      <div className="side-panel-header">Instructions (optional)</div>
      <div className="side-panel-body">
      <textarea
        className="prompt-bar-input"
        placeholder={
          improveGeneration
            ? 'Describe what to change in the selected generation, e.g. fill the body with red…'
            : 'e.g. make the cat orange, add a sunset background...'
        }
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
      />

      <label
        className={`prompt-bar-improve${!canImproveGeneration ? ' prompt-bar-improve-disabled' : ''}`}
        title={
          canImproveGeneration
            ? 'Send the selected generated image back to the model with your instructions'
            : 'Generate an image first, then select it in History to refine'
        }
      >
        <input
          type="checkbox"
          checked={improveGeneration}
          disabled={!canImproveGeneration}
          onChange={(e) => onImproveGenerationChange(e.target.checked)}
        />
        <span>Improve generation</span>
      </label>

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
        {isGenerating
          ? 'Generating…'
          : improveGeneration
            ? variations > 1
              ? `Improve ${variations} variations`
              : 'Improve generation'
            : variations > 1
              ? `Generate ${variations} variations`
              : 'Generate'}
      </button>
      </div>
    </div>
  )
}

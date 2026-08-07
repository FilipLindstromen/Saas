import './PromptBar.css'
import './StylePickerOverlay.css'
import GenerationProgress from './GenerationProgress'
import { estimateGenerationCost } from '../utils/generationCost'

export default function PromptBar({
  selectedStyle,
  onOpenStylePicker,
  value,
  onChange,
  onGenerate,
  isGenerating,
  generationProgress,
  error,
  variations,
  onVariationsChange,
  improveGeneration,
  onImproveGenerationChange,
  canImproveGeneration,
  useBrandColors,
  onUseBrandColorsChange,
  generationQuality,
  onGenerationQualityChange,
  addGenerationsAsLayers,
  onAddGenerationsAsLayersChange,
}) {
  const cost = estimateGenerationCost(generationQuality, variations)

  return (
    <div className="prompt-bar-section side-panel">
      <div className="side-panel-header">Instructions (optional)</div>
      <div className="side-panel-body">
      <div className="prompt-bar-style-row">
        <button type="button" className="prompt-bar-style-btn" onClick={onOpenStylePicker}>
          <span className="prompt-bar-style-btn-emoji" aria-hidden>{selectedStyle?.emoji ?? '✨'}</span>
          <span className="prompt-bar-style-btn-label">{selectedStyle?.name ?? 'Choose style'}</span>
          <span className="prompt-bar-style-btn-chevron" aria-hidden>›</span>
        </button>
      </div>
      <textarea
        className="prompt-bar-input"
        placeholder={
          improveGeneration
            ? 'Describe changes; ask to shrink or reflow layout if text was clipped at the edges…'
            : 'e.g. make the cat orange… Keep titles and graphics inset from the canvas edges.'
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

      <label
        className="prompt-bar-improve"
        title="Apply your brand palette and fonts from Settings to this generation"
      >
        <input
          type="checkbox"
          checked={useBrandColors}
          onChange={(e) => onUseBrandColorsChange(e.target.checked)}
        />
        <span>Use brand colors</span>
      </label>

      <label
        className="prompt-bar-improve"
        title="Each finished variation is added as a non-destructive layer on the sketch canvas"
      >
        <input
          type="checkbox"
          checked={addGenerationsAsLayers}
          onChange={(e) => onAddGenerationsAsLayersChange(e.target.checked)}
        />
        <span>Add generations as layers</span>
      </label>

      <div className="prompt-bar-quality">
        <span>Quality</span>
        <div className="prompt-bar-variations-options">
          <button
            type="button"
            className={generationQuality === 'low' ? 'active' : ''}
            onClick={() => onGenerationQualityChange('low')}
            title="Faster, lower cost draft images"
          >
            Draft
          </button>
          <button
            type="button"
            className={generationQuality === 'high' ? 'active' : ''}
            onClick={() => onGenerationQualityChange('high')}
            title="Standard quality"
          >
            Standard
          </button>
        </div>
        <span className="prompt-bar-cost" title="Indicative estimate only">
          {cost.label}
        </span>
      </div>

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
      {isGenerating && generationProgress && (
        <GenerationProgress progress={generationProgress} />
      )}
      <button
        type="button"
        className="prompt-bar-generate"
        onClick={onGenerate}
      >
        {isGenerating
          ? (generationProgress ? `${Math.round(generationProgress.percent)}%` : 'Add to queue')
          : improveGeneration
            ? variations > 1
              ? `Improve ${variations} variations`
              : 'Improve generation'
            : variations > 1
              ? `Generate ${variations} variations`
              : 'Generate'}
      </button>
      {isGenerating && (
        <p className="prompt-bar-queue-hint">You can switch drawings or queue more while jobs run.</p>
      )}
      </div>
    </div>
  )
}

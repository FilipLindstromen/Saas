import { getApiKey } from '@shared/apiKeys'
import {
  COPY_VERSION_COUNT,
  normalizeCopyVersions,
} from '../utils/copyVersions'
import { versionHasBackground } from '../utils/versionBackgrounds'
import './CopySection.css'

export default function CopySection({
  text,
  versionBackgrounds = [],
  onChange,
  analysis,
  aiBusy,
  aiError,
  onAnalyze,
  onGenerateVersions,
  panel = false,
}) {
  const hasOpenAiKey = !!getApiKey('openai')?.trim()
  const { copyVersions, activeCopyVersion } = normalizeCopyVersions(text)
  const activeSlot = copyVersions[activeCopyVersion]

  const updateActiveSlot = (patch) => {
    onChange((prev) => {
      const normalized = normalizeCopyVersions(prev)
      const nextVersions = [...normalized.copyVersions]
      nextVersions[normalized.activeCopyVersion] = {
        ...nextVersions[normalized.activeCopyVersion],
        ...patch,
      }
      return { ...prev, copyVersions: nextVersions, activeCopyVersion: normalized.activeCopyVersion }
    })
  }

  const setActiveVersion = (index) => {
    onChange((prev) => ({ ...prev, activeCopyVersion: index }))
  }

  const setFlag = (key, value) => {
    onChange((prev) => ({ ...prev, [key]: value }))
  }

  const hasSlotContent = (slot) => !!(slot?.headline?.trim() || slot?.copy?.trim() || slot?.linkTitle?.trim())

  return (
    <section className={`nag-copy-section ${panel ? 'nag-copy-panel-inner' : ''}`}>
      {panel && <h3 className="nag-section-title">Copy</h3>}

      <div className="nag-copy-version-tabs" role="tablist" aria-label="Copy versions">
        {Array.from({ length: COPY_VERSION_COUNT }, (_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={activeCopyVersion === i}
            className={`nag-copy-version-tab ${activeCopyVersion === i ? 'active' : ''} ${hasSlotContent(copyVersions[i]) ? 'has-content' : ''} ${versionHasBackground(versionBackgrounds[i]) ? 'has-background' : ''}`}
            onClick={() => setActiveVersion(i)}
            title={versionHasBackground(versionBackgrounds[i]) ? 'Has custom background' : undefined}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <p className="nag-hint nag-copy-version-hint">
        Version {activeCopyVersion + 1} is shown in the preview. Copy and background are saved per version (1–{COPY_VERSION_COUNT}).
      </p>

      <div className="nag-field-group">
        <label className="nag-label" htmlFor="nag-headline">Headline</label>
        <textarea
          id="nag-headline"
          className="nag-textarea"
          rows={2}
          value={activeSlot.headline}
          onChange={(e) => updateActiveSlot({ headline: e.target.value })}
          placeholder="Stop losing leads to slow follow-up"
        />
      </div>

      <div className="nag-field-group">
        <label className="nag-label" htmlFor="nag-copy">Sub headline</label>
        <textarea
          id="nag-copy"
          className="nag-textarea"
          rows={4}
          value={activeSlot.copy}
          onChange={(e) => updateActiveSlot({ copy: e.target.value })}
          placeholder="Automate outreach in minutes. Join 2,000+ teams who reply faster and close more deals."
        />
      </div>

      <div className="nag-field-group">
        <label className="nag-label" htmlFor="nag-link-title">Link title</label>
        <input
          id="nag-link-title"
          type="text"
          className="nag-input"
          value={activeSlot.linkTitle}
          onChange={(e) => updateActiveSlot({ linkTitle: e.target.value })}
          placeholder="Learn more"
        />
        <p className="nag-hint">CTA or display link text shown below the headline block.</p>
      </div>

      <label className="nag-checkbox">
        <input
          type="checkbox"
          checked={text.showSubheadline !== false}
          onChange={(e) => setFlag('showSubheadline', e.target.checked)}
        />
        <span>Show sub headline in image</span>
      </label>

      <label className="nag-checkbox">
        <input
          type="checkbox"
          checked={text.showLinkTitle !== false}
          onChange={(e) => setFlag('showLinkTitle', e.target.checked)}
        />
        <span>Show link title in image</span>
      </label>

      <div className="nag-ai-actions">
        <button
          type="button"
          className="nag-btn nag-btn-accent"
          disabled={aiBusy || !hasOpenAiKey}
          onClick={onAnalyze}
          title={!hasOpenAiKey ? 'Add OpenAI API key in SaaS Apps settings' : undefined}
        >
          {aiBusy ? 'Working…' : 'Analyze as David Ogilvy'}
        </button>
        <button
          type="button"
          className="nag-btn"
          disabled={aiBusy || !hasOpenAiKey}
          onClick={onGenerateVersions}
          title={!hasOpenAiKey ? 'Add OpenAI API key in SaaS Apps settings' : undefined}
        >
          Fill all {COPY_VERSION_COUNT} with AI
        </button>
      </div>

      {!hasOpenAiKey && (
        <p className="nag-hint">Add your OpenAI API key on the SaaS Apps screen to use AI copy tools.</p>
      )}

      {aiError && <p className="nag-error">{aiError}</p>}

      {analysis && (
        <div className="nag-analysis">
          <div className="nag-analysis-header">
            <h4 className="nag-subsection-title">Ogilvy analysis</h4>
            <span className="nag-analysis-score">{analysis.score}/10</span>
          </div>
          <p className="nag-analysis-summary">{analysis.summary}</p>
          {analysis.ogilvyVerdict && (
            <blockquote className="nag-analysis-verdict">"{analysis.ogilvyVerdict}"</blockquote>
          )}
          {analysis.strengths?.length > 0 && (
            <div className="nag-analysis-list">
              <span className="nag-analysis-label">Strengths</span>
              <ul>
                {analysis.strengths.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
          )}
          {analysis.weaknesses?.length > 0 && (
            <div className="nag-analysis-list">
              <span className="nag-analysis-label">Weaknesses</span>
              <ul>
                {analysis.weaknesses.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
          )}
          {analysis.suggestions?.length > 0 && (
            <div className="nag-analysis-list">
              <span className="nag-analysis-label">Suggestions</span>
              <ul>
                {analysis.suggestions.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

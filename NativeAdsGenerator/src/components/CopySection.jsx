import { getApiKey } from '@shared/apiKeys'
import { analyzeAsOgilvy, generateCopyVersions } from '../services/copyAi'
import './CopySection.css'

export default function CopySection({
  headline,
  copy,
  showSubheadline = true,
  onHeadlineChange,
  onCopyChange,
  onShowSubheadlineChange,
  analysis,
  versions,
  aiBusy,
  aiError,
  onAnalyze,
  onGenerateVersions,
  onApplyVersion,
  embedded = false,
}) {
  const hasOpenAiKey = !!getApiKey('openai')?.trim()

  return (
    <section className={`nag-panel-section nag-copy-section ${embedded ? 'nag-panel-embedded' : ''}`}>
      {!embedded && <h3 className="nag-section-title">Headline &amp; copy</h3>}

      <div className="nag-field-group">
        <label className="nag-label" htmlFor="nag-headline">Headline</label>
        <textarea
          id="nag-headline"
          className="nag-textarea"
          rows={2}
          value={headline}
          onChange={(e) => onHeadlineChange(e.target.value)}
          placeholder="Stop losing leads to slow follow-up"
        />
      </div>

      <div className="nag-field-group">
        <label className="nag-label" htmlFor="nag-copy">Sub headline</label>
        <textarea
          id="nag-copy"
          className="nag-textarea"
          rows={4}
          value={copy}
          onChange={(e) => onCopyChange(e.target.value)}
          placeholder="Automate outreach in minutes. Join 2,000+ teams who reply faster and close more deals."
        />
      </div>

      <label className="nag-checkbox">
        <input
          type="checkbox"
          checked={showSubheadline}
          onChange={(e) => onShowSubheadlineChange(e.target.checked)}
        />
        <span>Show sub headline in image</span>
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
          Create different versions
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

      {versions?.length > 0 && (
        <div className="nag-versions">
          <h4 className="nag-subsection-title">Versions</h4>
          <div className="nag-versions-list">
            {versions.map((v, i) => (
              <button
                key={i}
                type="button"
                className="nag-version-card"
                onClick={() => onApplyVersion(v)}
              >
                <span className="nag-version-angle">{v.angle}</span>
                <strong>{v.headline}</strong>
                <p>{v.copy}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

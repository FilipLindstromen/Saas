import { analyzeSlideText } from '../carousel/limits'
import './SlideLimitIndicator.css'

export default function SlideLimitIndicator({ slide, compact = false }) {
  if (!slide || (slide.layout || 'default') === 'section') return null
  const { warnings, headlineWords, bodyWords } = analyzeSlideText(slide)
  if (!warnings.length && compact) return null

  if (compact) {
    return warnings.length > 0 ? (
      <span className="slide-limit-dot" title={`${warnings.length} limit warning(s)`} aria-label="Over text limit" />
    ) : null
  }

  return (
    <div className="slide-limit-indicator">
      <span className={headlineWords > 12 ? 'over' : 'ok'}>{headlineWords}w headline</span>
      {bodyWords > 0 && (
        <span className={bodyWords > 35 ? 'over' : 'ok'}>{bodyWords}w body</span>
      )}
      {warnings.length > 0 && (
        <span className="slide-limit-warn" title="Text may be hard to read on mobile">⚠</span>
      )}
    </div>
  )
}

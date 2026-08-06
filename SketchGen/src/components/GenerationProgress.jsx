import './GenerationProgress.css'

/** Shared progress bar + status line for image generation. */
export default function GenerationProgress({ progress }) {
  if (!progress) return null
  const { message, percent, completed, total } = progress
  const showCount = total > 1

  return (
    <div className="generation-progress" role="status" aria-live="polite">
      <div className="generation-progress-head">
        <span className="generation-progress-message">{message}</span>
        <span className="generation-progress-percent">{Math.round(percent)}%</span>
      </div>
      <div className="generation-progress-track">
        <div
          className="generation-progress-fill"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      {showCount && (
        <span className="generation-progress-count">
          {completed} of {total} complete
        </span>
      )}
    </div>
  )
}

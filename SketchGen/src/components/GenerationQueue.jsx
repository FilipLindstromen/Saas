import './GenerationQueue.css'

const STATUS_LABEL = {
  queued: 'Queued',
  running: 'Generating…',
  done: 'Done',
  error: 'Failed',
  canceled: 'Canceled',
}

export default function GenerationQueue({
  jobs,
  onCancel,
  onRetry,
  onUseResult,
  onDismiss,
}) {
  if (!jobs?.length) return null
  const active = jobs.some((j) => j.status === 'queued' || j.status === 'running')

  return (
    <div className="generation-queue side-panel">
      <div className="side-panel-header">
        <span className="side-panel-header-label">Generation queue</span>
        {!active && (
          <button type="button" className="generation-queue-dismiss" onClick={onDismiss}>
            Clear
          </button>
        )}
      </div>
      <div className="side-panel-body generation-queue-list">
        {jobs.map((job) => (
          <div key={job.id} className={`generation-queue-item status-${job.status}`}>
            <div className="generation-queue-item-main">
              {job.dataUrl ? (
                <img src={job.dataUrl} alt="" className="generation-queue-thumb" />
              ) : (
                <div className="generation-queue-thumb generation-queue-thumb-empty" />
              )}
              <div className="generation-queue-meta">
                <span className="generation-queue-title">
                  {job.drawingLabel ? `${job.drawingLabel} · ` : ''}
                  Variation {job.index + 1}
                </span>
                <span className="generation-queue-status">{STATUS_LABEL[job.status] || job.status}</span>
                {job.error && <span className="generation-queue-error">{job.error}</span>}
              </div>
            </div>
            <div className="generation-queue-actions">
              {job.status === 'running' || job.status === 'queued' ? (
                <button type="button" className="generation-queue-btn" onClick={() => onCancel(job.id)}>
                  Cancel
                </button>
              ) : null}
              {job.status === 'error' ? (
                <button type="button" className="generation-queue-btn" onClick={() => onRetry(job.id)}>
                  Retry
                </button>
              ) : null}
              {job.status === 'done' && job.dataUrl ? (
                <button type="button" className="generation-queue-btn primary" onClick={() => onUseResult(job)}>
                  Use this
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

import './PresentationFeedback.css'

const LOADING = 'loading'
const DONE = 'done'
const ERROR = 'error'

function PresentationFeedback({ onClose, status, transcript, feedback, errorMessage, onUploadVideo }) {
  const isLoading = status === LOADING
  const isError = status === ERROR
  const isDone = status === DONE
  const isEmpty = !isLoading && !isError && !isDone

  return (
    <div className="presentation-feedback-backdrop" onClick={onClose}>
      <div className="presentation-feedback-modal" onClick={(e) => e.stopPropagation()}>
        <div className="presentation-feedback-header">
          <h2>Presentation feedback</h2>
          <button type="button" className="presentation-feedback-close" onClick={onClose} title="Close">
            ×
          </button>
        </div>

        {isEmpty && (
          <div className="presentation-feedback-body presentation-feedback-empty">
            <p className="presentation-feedback-empty-msg">No feedback yet.</p>
            <p className="presentation-feedback-empty-hint">Record your presentation in Present mode with <strong>Get AI feedback</strong> enabled in the recording bar to receive coach-style feedback on your content and pacing.</p>
            {onUploadVideo && (
              <button type="button" className="presentation-feedback-btn-upload" onClick={onUploadVideo}>
                Upload video
              </button>
            )}
          </div>
        )}

        {isLoading && (
          <div className="presentation-feedback-body presentation-feedback-loading">
            <div className="presentation-feedback-spinner" />
            <p>Transcribing your recording…</p>
            <p className="presentation-feedback-loading-sub">Then analyzing content and pacing as your coach.</p>
          </div>
        )}

        {isError && (
          <div className="presentation-feedback-body presentation-feedback-error">
            <p className="presentation-feedback-error-msg">{errorMessage || 'Something went wrong.'}</p>
            <p className="presentation-feedback-hint">Check your OpenAI API key in Settings and that the recording had audible speech.</p>
          </div>
        )}

        {isDone && (
          <div className="presentation-feedback-body">
            {feedback?.strengths?.length > 0 && (
              <section className="presentation-feedback-section">
                <h3>Strengths</h3>
                <ul>
                  {feedback.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </section>
            )}
            {feedback?.content && (
              <section className="presentation-feedback-section">
                <h3>Content</h3>
                <p>{feedback.content}</p>
              </section>
            )}
            {feedback?.pacing && (
              <section className="presentation-feedback-section">
                <h3>Pacing & speed</h3>
                <p>{feedback.pacing}</p>
              </section>
            )}
            {feedback?.improvements?.length > 0 && (
              <section className="presentation-feedback-section">
                <h3>Improvements to try</h3>
                <ul>
                  {feedback.improvements.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </section>
            )}
            {feedback?.slideFeedback?.length > 0 && (
              <section className="presentation-feedback-section presentation-feedback-by-slide">
                <h3>By slide</h3>
                <p className="presentation-feedback-by-slide-intro">Feedback for each slide based on what you said.</p>
                <div className="presentation-feedback-slide-list">
                  {feedback.slideFeedback.map((s, i) => (
                    <div key={i} className="presentation-feedback-slide-card">
                      <div className="presentation-feedback-slide-heading">
                        <span className="presentation-feedback-slide-num">Slide {s.slideIndex + 1}</span>
                        <span className="presentation-feedback-slide-title">{s.slideTitle || `Slide ${s.slideIndex + 1}`}</span>
                      </div>
                      {s.whatWorked && (
                        <p className="presentation-feedback-slide-what-worked">
                          <strong>What worked:</strong> {s.whatWorked}
                        </p>
                      )}
                      {s.suggestion && (
                        <p className="presentation-feedback-slide-suggestion">
                          <strong>Suggestion:</strong> {s.suggestion}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
            {feedback?.raw && !feedback?.content && !feedback?.pacing && (
              <section className="presentation-feedback-section">
                <h3>Coach feedback</h3>
                <pre className="presentation-feedback-raw">{feedback.raw}</pre>
              </section>
            )}
            {transcript && (
              <section className="presentation-feedback-section presentation-feedback-transcript">
                <h3>Transcript</h3>
                <p className="presentation-feedback-transcript-text">{transcript}</p>
              </section>
            )}
          </div>
        )}

        <div className="presentation-feedback-footer">
          <button type="button" className="presentation-feedback-btn-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default PresentationFeedback
export { LOADING, DONE, ERROR }

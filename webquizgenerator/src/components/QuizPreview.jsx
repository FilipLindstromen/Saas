import React, { useState, useEffect } from 'react'
import './QuizPreview.css'

function QuizPreview({ quizData, isOpen, onClose, typography, theme, embedded = false }) {
  const [step, setStep] = useState('title')
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedTags, setSelectedTags] = useState([])
  const [worstTag, setWorstTag] = useState(null)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [answerHistory, setAnswerHistory] = useState([]) // { question, answer } for personalized results
  const [transitionDir, setTransitionDir] = useState('next') // 'next' | 'prev' for slide animation

  const typo = typography || {}
  const th = theme || {}
  const backgroundStyle = th.backgroundType === 'image'
    ? { backgroundImage: `url(${th.backgroundValue || ''})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : th.backgroundType === 'color'
      ? { background: th.backgroundValue || '#00080d' }
      : { background: th.backgroundValue || 'linear-gradient(333deg, rgba(0, 8, 13, 1) 0%, rgba(18, 45, 61, 1) 35%, rgba(10, 75, 92, 1) 100%)' }

  useEffect(() => {
    if (isOpen) {
      resetPreview()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const resetPreview = () => {
    setStep('title')
    setCurrentQuestion(0)
    setSelectedTags([])
    setWorstTag(null)
    setSelectedAnswer(null)
    setAnswerHistory([])
    setTransitionDir('next')
  }

  const handleStart = () => {
    setStep('quiz')
    setCurrentQuestion(0)
  }

  const handleAnswerSelect = (answer) => {
    setSelectedAnswer(answer)
  }

  const handleNext = () => {
    if (!selectedAnswer || !quizData.questions) return

    const tag = selectedAnswer.tag
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag])
    }

    // Question 3 (index 2) = "which feels WORST"
    if (currentQuestion === 2) {
      setWorstTag(tag)
    }

    const q = quizData.questions[currentQuestion]
    setAnswerHistory(prev => [...prev, { question: q?.q, answer: selectedAnswer.label }])
    setTransitionDir('next')

    if (currentQuestion < quizData.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
      setSelectedAnswer(null)
    } else {
      setStep('result')
    }
  }

  const handlePrev = () => {
    if (currentQuestion === 0) return
    const prevQ = quizData.questions[currentQuestion - 1]
    const lastEntry = answerHistory[answerHistory.length - 1]
    const prevAnswer = prevQ?.answers?.find(a => a.label === lastEntry?.answer)
    if (prevAnswer?.tag) setSelectedTags(prev => prev.filter(t => t !== prevAnswer.tag))
    if (currentQuestion - 1 === 2) setWorstTag(null)
    setTransitionDir('prev')
    setCurrentQuestion(currentQuestion - 1)
    setAnswerHistory(prev => prev.slice(0, -1))
    setSelectedAnswer(prevAnswer || null)
  }

  useEffect(() => {
    const handler = (e) => {
      if (step === 'title') {
        if (e.key === 'Enter') handleStart()
        return
      }
      if (step === 'result') return
      if (!quizData.questions?.length) return
      const q = quizData.questions[currentQuestion]
      const answers = q?.answers || []
      if (e.key === 'Enter' && selectedAnswer) {
        e.preventDefault()
        handleNext()
      } else if (e.key === 'ArrowLeft' && currentQuestion > 0) {
        handlePrev()
      } else if (e.key === 'ArrowUp' && answers.length > 0) {
        e.preventDefault()
        const idx = selectedAnswer ? answers.findIndex(a => a.tag === selectedAnswer.tag) : -1
        const nextIdx = idx <= 0 ? answers.length - 1 : idx - 1
        setSelectedAnswer(answers[nextIdx])
      } else if (e.key === 'ArrowDown' && answers.length > 0) {
        e.preventDefault()
        const idx = selectedAnswer ? answers.findIndex(a => a.tag === selectedAnswer.tag) : -1
        const nextIdx = idx < 0 || idx >= answers.length - 1 ? 0 : idx + 1
        setSelectedAnswer(answers[nextIdx])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [step, currentQuestion, selectedAnswer, quizData.questions, handleStart, handleNext, handlePrev])

  const renderTitle = () => (
    <div className="preview-title-screen" style={backgroundStyle}>
      <h1 style={{ fontFamily: typo.titleFont, fontSize: typo.titleSize }}>{quizData.quizTitle}</h1>
      <p style={{ fontFamily: typo.feedbackFont }}>{quizData.quizSubtitle}</p>
      <button className="preview-start-btn" onClick={handleStart}>
        START THE QUIZ
      </button>
    </div>
  )

  const renderQuestion = () => {
    if (!quizData.questions || quizData.questions.length === 0) {
      return (
        <div className="preview-quiz-screen" style={backgroundStyle}>
          <p>No questions available. Please add questions to preview the quiz.</p>
        </div>
      )
    }
    const question = quizData.questions[currentQuestion]
    if (!question) return null

    const progressPct = ((currentQuestion + 1) / quizData.questions.length) * 100

    return (
      <div className="preview-quiz-screen" style={backgroundStyle}>
        <div className="preview-progress-bar-wrap">
          <div className="preview-progress-bar" style={{ width: `${progressPct}%` }} />
        </div>
        <div key={currentQuestion} className={`preview-question-slide preview-slide-${transitionDir}`}>
          <div className="preview-progress-text">
            {currentQuestion + 1} of {quizData.questions.length}
          </div>
          <div
            className="preview-question-text"
            style={{ fontFamily: typo.questionFont, fontSize: typo.questionSize }}
          >
            {question.q}
          </div>
          <div className="preview-answers">
            {question.answers.map((answer, idx) => (
              <div
                key={idx}
                className={`preview-answer preview-answer-stagger ${selectedAnswer?.tag === answer.tag ? 'active' : ''}`}
                style={{
                  fontFamily: typo.answerFont,
                  fontSize: typo.answerSize,
                  animationDelay: `${idx * 0.06}s`
                }}
                onClick={() => handleAnswerSelect(answer)}
              >
                {answer.label}
              </div>
            ))}
          </div>
          <div className="preview-quiz-actions">
            {currentQuestion > 0 && (
              <button type="button" className="preview-back-btn" onClick={handlePrev} aria-label="Go back">
                ← Back
              </button>
            )}
            <button
              className="preview-next-btn"
              onClick={handleNext}
              disabled={!selectedAnswer}
            >
              →
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderResult = () => {
    const tags = selectedTags.length ? selectedTags : ['default']
    const dominantTag = tags[0]
    const labels = quizData.tagLabels || {}
    const headlines = quizData.headlines || {}
    const insights = quizData.tagInsights || {}
    const ctas = quizData.cta || {}

    const headline = headlines[dominantTag] || headlines.default || 'Your Results'
    const cta = ctas[dominantTag] || ctas.default || 'Learn More'
    const worstLabel = labels[worstTag] || labels.default || 'anxiety'

    // Group tags
    const mindTags = new Set(['racingMind', 'thinking', 'lossOfControl', 'random', 'social', 'nighttime'])
    const bodyTags = new Set(['body', 'cortisol', 'pressure', 'avoidance', 'presence'])

    let mindText = ''
    let bodyText = ''
    let extraText = ''

    tags.forEach(tag => {
      const block = insights[tag]
      if (!block) return
      if (mindTags.has(tag)) {
        mindText += (mindText ? '\n\n' : '') + block
      } else if (bodyTags.has(tag)) {
        bodyText += (bodyText ? '\n\n' : '') + block
      } else {
        extraText += (extraText ? '\n\n' : '') + block
      }
    })

    const feelsText = `For you, anxiety hits hardest as **${worstLabel}**.\n\nThat's the part your system turns up the loudest when it feels overwhelmed — which is why it can feel so intense, so fast, and so hard to switch off.`

    let nextStepsText = feelsText
    if (mindText) nextStepsText += `\n\n${mindText}`
    if (bodyText) nextStepsText += `\n\n${bodyText}`
    if (extraText) nextStepsText += `\n\n${extraText}`
    nextStepsText += `\n\n${quizData.summary || ''}`

    return (
      <div className="preview-result-screen" style={backgroundStyle}>
        <div className="preview-result-container">
          <div className="preview-result-close" onClick={resetPreview}>×</div>
          <div
            className="preview-result-title"
            style={{ fontFamily: typo.titleFont, fontSize: typo.titleSize }}
          >
            {headline}
          </div>
          <div
            className="preview-result-subtitle"
            style={{ fontFamily: typo.feedbackFont }}
          >
            Based on your answers
          </div>
          {answerHistory.length > 0 && (
            <div className="preview-result-summary">
              {answerHistory.map((entry, i) => (
                <div key={i} className="preview-result-summary-item">
                  <span className="preview-result-summary-q">{entry.question}</span>
                  <span className="preview-result-summary-a">→ {entry.answer}</span>
                </div>
              ))}
            </div>
          )}
          <div className="preview-result-card">
            <h3>Your Pattern</h3>
            <div
              className="preview-result-body"
              style={{ fontFamily: typo.feedbackFont, fontSize: typo.feedbackSize }}
            >
              {feelsText}
            </div>
          </div>
          <div className="preview-result-card">
            <h3>Next Steps</h3>
            <div
              className="preview-result-body"
              style={{ fontFamily: typo.feedbackFont, fontSize: typo.feedbackSize }}
            >
              {nextStepsText}
            </div>
          </div>
          <button className="preview-result-cta" style={{ fontFamily: typo.feedbackFont }}>{cta}</button>
        </div>
      </div>
    )
  }

  if (!embedded && !isOpen) return null

  const previewContent = (
    <div className={`preview-content-wrapper ${embedded ? 'preview-embedded' : ''}`}>
      {step === 'title' && renderTitle()}
      {step === 'quiz' && renderQuestion()}
      {step === 'result' && renderResult()}
    </div>
  )

  if (embedded) {
    return (
      <div className="quiz-canvas">
        <div className="quiz-canvas-inner">
          {previewContent}
          {step !== 'title' && (
            <div className="quiz-canvas-controls">
              <button onClick={resetPreview} className="btn-secondary btn-sm">
                Reset
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="preview-overlay" onClick={onClose}>
      <div className="preview-container" onClick={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <h2>Quiz Preview</h2>
          <button className="preview-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="preview-content">
          {previewContent}
        </div>
        {step !== 'title' && (
          <div className="preview-controls">
            <button onClick={resetPreview} className="preview-reset-btn">
              Reset Preview
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default QuizPreview


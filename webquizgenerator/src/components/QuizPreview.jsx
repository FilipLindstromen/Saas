import React, { useState, useEffect } from 'react'
import './QuizPreview.css'

function QuizPreview({ quizData, isOpen, onClose, typography, theme }) {
  const [step, setStep] = useState('title')
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedTags, setSelectedTags] = useState([])
  const [worstTag, setWorstTag] = useState(null)
  const [selectedAnswer, setSelectedAnswer] = useState(null)

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

    if (currentQuestion < quizData.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
      setSelectedAnswer(null)
    } else {
      setStep('result')
    }
  }

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

    return (
      <div className="preview-quiz-screen" style={backgroundStyle}>
        <div className="preview-progress">
          {currentQuestion + 1}/{quizData.questions.length}
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
              className={`preview-answer ${selectedAnswer?.tag === answer.tag ? 'active' : ''}`}
              style={{ fontFamily: typo.answerFont, fontSize: typo.answerSize }}
              onClick={() => handleAnswerSelect(answer)}
            >
              {answer.label}
            </div>
          ))}
        </div>
        <button
          className="preview-next-btn"
          onClick={handleNext}
          disabled={!selectedAnswer}
        >
          →
        </button>
      </div>
    )
  }

  const renderResult = () => {
    if (!selectedTags.length) {
      selectedTags.push('default')
    }

    const dominantTag = selectedTags[0]
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

    selectedTags.forEach(tag => {
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
            Here's what your answers reveal.
          </div>
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

  if (!isOpen) return null

  return (
    <div className="preview-overlay" onClick={onClose}>
      <div className="preview-container" onClick={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <h2>Quiz Preview</h2>
          <button className="preview-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="preview-content">
          {step === 'title' && renderTitle()}
          {step === 'quiz' && renderQuestion()}
          {step === 'result' && renderResult()}
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


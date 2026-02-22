import React, { useState, useEffect, useCallback, useRef } from 'react'
import QuizBasicInfo from './QuizBasicInfo'
import QuestionsEditor from './QuestionsEditor'
import FeedbackEditor from './FeedbackEditor'
import ExportButton from './ExportButton'
import OpenAIGenerator from './OpenAIGenerator'
import QuizPreview from './QuizPreview'
import ThemeTypographyEditor from './ThemeTypographyEditor'
import './QuizEditor.css'

const STORAGE_KEY_LEFT = 'webquiz_panel_left_width'
const STORAGE_KEY_RIGHT = 'webquiz_panel_right_width'
const MIN_PANEL = 200
const MAX_PANEL = 500
const DEFAULT_LEFT = 280
const DEFAULT_RIGHT = 320

function QuizEditor() {
  const ensureTagKeys = (tags, prev) => {
    const nextLabels = { ...prev.tagLabels }
    const nextHeadlines = { ...prev.headlines }
    const nextInsights = { ...prev.tagInsights }
    const nextCtas = { ...prev.cta }
    tags.forEach(tag => {
      if (!nextLabels[tag]) nextLabels[tag] = ''
      if (!nextHeadlines[tag]) nextHeadlines[tag] = ''
      if (!nextInsights[tag]) nextInsights[tag] = ''
      if (!nextCtas[tag]) nextCtas[tag] = ''
    })
    return {
      tagLabels: nextLabels,
      headlines: nextHeadlines,
      tagInsights: nextInsights,
      cta: nextCtas
    }
  }

  const collectTags = (questionsList) => {
    const s = new Set()
    questionsList.forEach(q => q.answers.forEach(a => a.tag && s.add(a.tag)))
    return Array.from(s)
  }

  const [quizData, setQuizData] = useState({
    quizTitle: 'Discover your anxiety type.',
    quizSubtitle: '\nHow Are You Doing? \nTake this Anxiety Test to discover your anxiety patterns.\n\n Discover how anxiety is affecting your daily life and receive a personalized roadmap to feel more calm, clear, and in control.\n\n',
    questions: [
      {
        id: 1,
        q: 'When does anxiety usually show up for you?',
        answers: [
          { id: 1, label: 'Out of nowhere, random moments', tag: 'random' },
          { id: 2, label: 'When things get quiet (morning/night)', tag: 'racingMind' },
          { id: 3, label: 'During work, expectations, pressure', tag: 'pressure' },
          { id: 4, label: 'In social or unfamiliar situations', tag: 'social' }
        ]
      }
    ],
    tagLabels: {
      random: 'the physical intensity in your body',
      racingMind: 'the racing, overwhelming thoughts',
      pressure: 'the pressure to perform or get things right',
      lossOfControl: 'the feeling of not being fully in control of your mind',
      cortisol: 'the heavy, tense feeling in your chest or stomach',
      social: 'the fear of being judged or watched',
      default: 'the part of anxiety that feels the hardest for you'
    },
    headlines: {
      random: 'Your System Reacts Even Before You Notice Stress',
      racingMind: 'Your Brain Shifts Into a Racing-Mind Survival Loop',
      pressure: 'Your System Interprets Pressure as Potential Danger',
      social: 'Your System Becomes Hyper-Aware of How You\'re Seen',
      default: 'Your System Is Working Overtime to Protect You'
    },
    tagInsights: {
      random: 'Your system is reacting to stress signals faster than your conscious mind registers them.\n\n• Your brain enters survival mode milliseconds before you feel anything.\n• Your body releases cortisol without a clear trigger.\n• Your nervous system fires the alarm because it has become highly sensitive.\n\nAha-moment: It\'s not random — it\'s your system reacting early, before you consciously notice the stress.',
      racingMind: 'Your mind speeds up because it thinks it needs to stay ahead of danger.\n\n• Your brain scans for threats, even subtle or imagined ones.\n• Cortisol increases mental speed and urgency.\n• Clear thinking becomes harder because your brain prioritises protection over logic.\n\nAha-moment: Your mind isn\'t out of control — it\'s trying too hard to keep you safe.',
      default: 'Your system is working overtime to protect you from perceived threats.'
    },
    summary: 'Every time anxiety shows up, the same core pattern unfolds:\n\n• Your brain shifts into survival mode.\n• Your body releases stress hormones like cortisol.\n• Your nervous system moves toward fight, flight, or freeze.\n\nWhat\'s unique about you is what tends to trigger that response, and which part of the experience feels the hardest. None of this means you\'re broken — it means your system has been working overtime. Once you learn how to calm your mind, release stored stress, and signal safety to your nervous system, these patterns stop feeling so overwhelming.',
    cta: {
      random: '👉 Show Me How to Calm This "Out of Nowhere" Anxiety',
      racingMind: '👉 Teach Me How to Slow My Thoughts Instantly',
      pressure: '👉 Show Me How to Feel Safe Under Pressure',
      default: '👉 Show Me How to Feel Less Anxious Fast'
    },
    typography: {
      titleFont: 'Oswald',
      titleSize: '2.4rem',
      questionFont: 'Oswald',
      questionSize: '1.85rem',
      answerFont: 'Inter',
      answerSize: '1.05rem',
      feedbackFont: 'Inter',
      feedbackSize: '1rem'
    },
    theme: {
      backgroundType: 'gradient',
      backgroundValue: 'linear-gradient(333deg, #00080d 0%, #122d3d 35%, #0a4b5c 100%)',
      gradientStart: '#00080d',
      gradientEnd: '#0a4b5c',
      gradientAngle: 333
    }
  })

  const updateBasicInfo = (field, value) => {
    setQuizData(prev => ({ ...prev, [field]: value }))
  }

  const updateQuestions = (questions) => {
    setQuizData(prev => {
      const tags = collectTags(questions)
      const synced = ensureTagKeys(tags, prev)
      return { ...prev, ...synced, questions }
    })
  }

  const updateFeedback = (feedbackData) => {
    setQuizData(prev => ({ ...prev, ...feedbackData }))
  }

  const updateTypography = (field, value) => {
    setQuizData(prev => ({
      ...prev,
      typography: { ...prev.typography, [field]: value }
    }))
  }

  const updateTheme = (themeData) => {
    if (themeData.gradientStart || themeData.gradientEnd || typeof themeData.gradientAngle !== 'undefined') {
      const start = themeData.gradientStart ?? quizData.theme.gradientStart
      const end = themeData.gradientEnd ?? quizData.theme.gradientEnd
      const angle = themeData.gradientAngle ?? quizData.theme.gradientAngle ?? 333
      themeData.backgroundValue = `linear-gradient(${angle}deg, ${start} 0%, ${end} 100%)`
    }
    setQuizData(prev => ({
      ...prev,
      theme: { ...prev.theme, ...themeData }
    }))
  }

  const handleOpenAIGenerate = (generatedData) => {
    setQuizData(prev => {
      const tags = collectTags(generatedData.questions || prev.questions)
      const synced = ensureTagKeys(tags, { ...prev, ...generatedData })
      return {
        ...prev,
        ...generatedData,
        ...synced
      }
    })
  }

  const [showPreview, setShowPreview] = useState(false)
  const [showAI, setShowAI] = useState(true)

  const [leftWidth, setLeftWidth] = useState(() => {
    const v = localStorage.getItem(STORAGE_KEY_LEFT)
    const n = v ? parseInt(v, 10) : NaN
    return !isNaN(n) && n >= MIN_PANEL && n <= MAX_PANEL ? n : DEFAULT_LEFT
  })
  const [rightWidth, setRightWidth] = useState(() => {
    const v = localStorage.getItem(STORAGE_KEY_RIGHT)
    const n = v ? parseInt(v, 10) : NaN
    return !isNaN(n) && n >= MIN_PANEL && n <= MAX_PANEL ? n : DEFAULT_RIGHT
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LEFT, String(leftWidth))
  }, [leftWidth])
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_RIGHT, String(rightWidth))
  }, [rightWidth])

  const [resizing, setResizing] = useState(null)
  const containerRef = useRef(null)

  const handleResizeMove = useCallback((e) => {
    const el = containerRef.current?.parentElement
    if (!el) return
    const { left, right } = el.getBoundingClientRect()
    if (resizing === 'left') {
      const w = Math.min(MAX_PANEL, Math.max(MIN_PANEL, e.clientX - left))
      setLeftWidth(w)
    } else if (resizing === 'right') {
      const w = Math.min(MAX_PANEL, Math.max(MIN_PANEL, right - e.clientX))
      setRightWidth(w)
    }
  }, [resizing])

  const handleResizeEnd = useCallback(() => setResizing(null), [])

  useEffect(() => {
    if (!resizing) return
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', handleResizeMove)
    window.addEventListener('mouseup', handleResizeEnd)
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', handleResizeMove)
      window.removeEventListener('mouseup', handleResizeEnd)
    }
  }, [resizing, handleResizeMove, handleResizeEnd])

  return (
    <>
      {/* Left Panel: Style, AI, Basic Info */}
      <div ref={containerRef} className="app-left" style={{ width: leftWidth }}>
        <div className="panel-scroll">
          <div className="panel-section">
            <ThemeTypographyEditor
              typography={quizData.typography}
              theme={quizData.theme}
              onTypographyChange={updateTypography}
              onThemeChange={updateTheme}
            />
          </div>
          <div className="panel-section">
            <div className="panel-section-header">
              <h3>AI Content Generator</h3>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setShowAI(!showAI)}
              >
                {showAI ? 'Hide' : 'Show'}
              </button>
            </div>
            {showAI && (
              <OpenAIGenerator onGenerate={handleOpenAIGenerate} currentData={quizData} />
            )}
          </div>
          <div className="panel-section">
            <QuizBasicInfo
              title={quizData.quizTitle}
              subtitle={quizData.quizSubtitle}
              summary={quizData.summary}
              onUpdate={updateBasicInfo}
            />
          </div>
        </div>
      </div>

      <div
        className={`app-resizer app-resizer-left ${resizing === 'left' ? 'active' : ''}`}
        onMouseDown={(e) => { e.preventDefault(); setResizing('left') }}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize left panel"
      />

      {/* Center: Live Preview Canvas */}
      <div className="app-center">
        <QuizPreview
          quizData={quizData}
          typography={quizData.typography}
          theme={quizData.theme}
          embedded={true}
        />
      </div>

      <div
        className={`app-resizer app-resizer-right ${resizing === 'right' ? 'active' : ''}`}
        onMouseDown={(e) => { e.preventDefault(); setResizing('right') }}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize right panel"
      />

      {/* Right Panel: Questions, Feedback, Export */}
      <div className="app-right" style={{ width: rightWidth }}>
        <div className="panel-scroll">
          <div className="panel-section">
            <QuestionsEditor
              questions={quizData.questions}
              onUpdate={updateQuestions}
            />
          </div>
          <div className="panel-section">
            <FeedbackEditor
              questions={quizData.questions}
              tagLabels={quizData.tagLabels}
              headlines={quizData.headlines}
              tagInsights={quizData.tagInsights}
              cta={quizData.cta}
              onUpdate={updateFeedback}
            />
          </div>
          <div className="panel-section">
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="btn-secondary btn-preview"
            >
              Full Screen Preview
            </button>
          </div>
          <div className="panel-section">
            <ExportButton quizData={quizData} />
          </div>
        </div>
      </div>

      <QuizPreview
        quizData={quizData}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        typography={quizData.typography}
        theme={quizData.theme}
      />
    </>
  )
}

export default QuizEditor

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useQuizState, createBooleanQuestion, createMultipleChoiceQuestion } from '../state'
import { useMemeState } from '../memeState'
import { QuizQuestion, QuizData, QuizAnswer, AspectRatio, MemeData, QuizBackground, QuizSettings, OverlayTextItem, OverlaySettings, OverlayAnimation, OverlayHorizontalAlign, OverlayVerticalPosition } from '../types'
import { CanvasRecorder, CanvasRecordingOptions } from '../utils/canvasRecorder'
import { computeQuizTimeline } from '../utils/quizTiming'
import { AIModal } from '../components/AIModal'
import { StockMediaModal } from '../components/StockMediaModal'
import { PixabayMusicModal } from '../components/PixabayMusicModal'
import { TikTokMusicModal } from '../components/TikTokMusicModal'
import { FreesoundMusicModal } from '../components/FreesoundMusicModal'
import { LocalMusicModal } from '../components/LocalMusicModal'
import { YouTubeAudioModal } from '../components/YouTubeAudioModal'
import { RealMusicModal } from '../components/RealMusicModal'
import { MemeAIModal } from '../components/MemeAIModal'
import { MemePreview } from '../components/MemePreview'
import { MemeSettingsPanel } from '../components/MemeSettingsPanel'
import { LabeledSlider } from '../components/LabeledSlider'
import { BackgroundRenderer } from '../components/BackgroundRenderer'
import { SequencePreview } from '../components/SequencePreview'
import { createTestAudio } from '../utils/testAudio'
import { TransparentTextarea } from '../components/TransparentTextarea'

export function App() {
  const {
    quiz,
    updateTitle,
    updateBackground,
    updateSettings,
    addQuestion,
    updateQuestion,
    removeQuestion,
    toJsonString,
    loadFromJsonString,
    reorderQuestions,
  } = useQuizState()

  const {
    meme,
    updateTopText,
    updateBottomText,
    updateBackground: updateMemeBackground,
    updateSettings: updateMemeSettings,
    toJsonString: memeToJsonString,
    loadFromJsonString: loadMemeFromJsonString,
  } = useMemeState()

  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(quiz.questions[0]?.id ?? null)
  const [draggedQuestionId, setDraggedQuestionId] = useState<string | null>(null)
  const [dragOverInfo, setDragOverInfo] = useState<{ targetId: string | null; position: 'before' | 'after' } | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playVersion, setPlayVersion] = useState(0)
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingStatus, setRecordingStatus] = useState('')
  const [recordingProgress, setRecordingProgress] = useState(0)
  const [videoQuality, setVideoQuality] = useState<'low' | 'medium' | 'high' | 'ultra'>('high')
  const [exportFormat, setExportFormat] = useState<'webm' | 'mp4'>('webm')
  const [activeTab, setActiveTab] = useState<'settings' | 'questions' | 'meme' | 'overlay'>('settings')

  // AI state
  const [customInstructions, setCustomInstructions] = useState(() => localStorage.getItem('customInstructions') || '')
  const [idea, setIdea] = useState(() => localStorage.getItem('idea') || '')
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false)
  const [openaiApiKey, setOpenaiApiKey] = useState(() => localStorage.getItem('openaiApiKey') || '')
  const [showAIModal, setShowAIModal] = useState(false)

  // Meme AI state
  const [showMemeAIModal, setShowMemeAIModal] = useState(false)
  const [showMemeBackground, setShowMemeBackground] = useState(false)

  // Stock media state
  const [showStockMedia, setShowStockMedia] = useState(false)
  const [stockMediaType, setStockMediaType] = useState<'image' | 'video'>('image')
  
  // Split screen stock media state
  const [showSplitScreenStockMedia, setShowSplitScreenStockMedia] = useState(false)
  const [splitScreenStockMediaType, setSplitScreenStockMediaType] = useState<'image' | 'video'>('video')
  const [splitScreenStockMediaTarget, setSplitScreenStockMediaTarget] = useState<'upper' | 'lower'>('upper')

  // Music state
  const [showPixabayMusic, setShowPixabayMusic] = useState(false)
  const [showTikTokMusic, setShowTikTokMusic] = useState(false)
  const [showFreesoundMusic, setShowFreesoundMusic] = useState(false)
  const [showLocalMusic, setShowLocalMusic] = useState(false)
  const [showYouTubeAudio, setShowYouTubeAudio] = useState(false)
  const [showRealMusic, setShowRealMusic] = useState(false)

  const fontOptions = useMemo(
    () => [
      'Impact',
      'Arial Black',
      'Helvetica',
      'Poppins',
      'Montserrat',
      'Lato',
      'Playfair Display',
      'Oswald',
      'Roboto Condensed',
      'Bebas Neue',
      'Pacifico',
      'Comic Sans MS',
      'Times New Roman',
      'Georgia',
      'Verdana',
      'Trebuchet MS'
    ],
    []
  )
  const overlayAnimationOptions = useMemo<{ value: OverlayAnimation; label: string }[]>(() => [
    { value: 'none', label: 'None' },
    { value: 'fade', label: 'Fade' },
    { value: 'slide-up', label: 'Slide Up' },
    { value: 'slide-down', label: 'Slide Down' },
    { value: 'scale', label: 'Scale' }
  ], [])

  const overlayVerticalOptions = useMemo<{ value: OverlayVerticalPosition; label: string }[]>(() => [
    { value: 'top', label: 'Top' },
    { value: 'center', label: 'Center' },
    { value: 'bottom', label: 'Bottom' }
  ], [])

  const overlayAlignOptions = useMemo<{ value: OverlayHorizontalAlign; label: string }[]>(() => [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Center' },
    { value: 'right', label: 'Right' }
  ], [])

  const defaultOverlaySettings = useMemo<OverlaySettings>(() => ({
    enabled: false,
    items: []
  }), [])

  const applyOverlayUpdate = useCallback(
    (updater: (overlay: OverlaySettings) => OverlaySettings) => {
      updateSettings(s => {
        const mergedOverlay: OverlaySettings = {
          enabled: s.overlay?.enabled ?? defaultOverlaySettings.enabled,
          items: [...(s.overlay?.items ?? defaultOverlaySettings.items)]
        }
        const updatedOverlay = updater(mergedOverlay)
        return { ...s, overlay: updatedOverlay }
      })
    },
    [updateSettings, defaultOverlaySettings]
  )

  const currentOverlay = useMemo<OverlaySettings>(() => ({
    enabled: quiz.settings?.overlay?.enabled ?? defaultOverlaySettings.enabled,
    items: [...(quiz.settings?.overlay?.items ?? defaultOverlaySettings.items)]
  }), [defaultOverlaySettings, quiz.settings?.overlay])

  const defaultCTASettings = useMemo<NonNullable<QuizSettings['cta']>>(() => ({
    enabled: false,
    durationMs: 3000,
    useSameBackground: true,
    backgroundVideoUrl: undefined,
    backgroundType: 'video',
    showText: true,
    text: 'Thank You!',
    textSizePercent: 8,
    textColor: '#ffffff',
    textShadowEnabled: true,
    textShadowColor: '#000000',
    fontFamily: 'Impact',
    fadeInMs: 600,
    holdMs: 1800,
    fadeOutMs: 0,
    overlayEnabled: false,
    overlayColor: '#000000',
    overlayOpacity: 0.4
  }), [])

  const applyCTAUpdate = useCallback(
    (updater: (cta: typeof defaultCTASettings) => typeof defaultCTASettings) => {
      updateSettings(s => {
        const merged = { ...defaultCTASettings, ...(s.cta ?? {}) }
        const updated = updater(merged)
        return { ...s, cta: updated }
      })
    },
    [updateSettings, defaultCTASettings]
  )

  const currentCTA = useMemo(
    () => ({ ...defaultCTASettings, ...(quiz.settings?.cta ?? {}) }),
    [defaultCTASettings, quiz.settings?.cta]
  )

  const createOverlayItem = useCallback((): OverlayTextItem => ({
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    text: 'Overlay text',
    fontFamily: quiz.settings?.fontFamily ?? 'Impact',
    fontSizePercent: 4,
    textColor: '#ffffff',
    backgroundColor: '#000000',
    backgroundOpacity: 0.7,
    padding: 12,
    align: 'center',
    verticalPosition: 'center',
    animationIn: 'fade',
    animationOut: 'fade',
    animationInDurationMs: 500,
    animationOutDurationMs: 500,
    displayDurationMs: 2000,
    startOffsetMs: 0
  }), [quiz.settings?.fontFamily])

  const handleAddOverlay = useCallback(() => {
    const newItem = createOverlayItem()
    applyOverlayUpdate(overlay => ({
      ...overlay,
      items: [...overlay.items, newItem]
    }))
  }, [applyOverlayUpdate, createOverlayItem])

  const updateOverlayItem = useCallback((id: string, updater: (item: OverlayTextItem) => OverlayTextItem) => {
    applyOverlayUpdate(overlay => ({
      ...overlay,
      items: overlay.items.map(item => (item.id === id ? updater(item) : item))
    }))
  }, [applyOverlayUpdate])

  const removeOverlayItem = useCallback((id: string) => {
    applyOverlayUpdate(overlay => ({
      ...overlay,
      items: overlay.items.filter(item => item.id !== id)
    }))
  }, [applyOverlayUpdate])

  // Background state
  const [previousBackground, setPreviousBackground] = useState<{image?: string, video?: string}>(() => {
    try {
      const stored = localStorage.getItem('previousBackground')
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })

  const selectedQuestion = useMemo(() => quiz.questions.find(q => q.id === selectedQuestionId) ?? null, [quiz, selectedQuestionId])

  const handleQuestionDragStart = (event: React.DragEvent<HTMLDivElement>, questionId: string) => {
    event.dataTransfer.setData('text/plain', questionId)
    event.dataTransfer.effectAllowed = 'move'
    setDraggedQuestionId(questionId)
    setDragOverInfo(null)
  }

  const handleQuestionDragOver = (event: React.DragEvent<HTMLDivElement>, questionId: string) => {
    if (!draggedQuestionId || draggedQuestionId === questionId) return
    event.preventDefault()
    event.stopPropagation()

    const rect = event.currentTarget.getBoundingClientRect()
    const isBefore = event.clientY < rect.top + rect.height / 2
    const position = isBefore ? 'before' : 'after'

    setDragOverInfo(prev => {
      if (prev?.targetId === questionId && prev.position === position) return prev
      return { targetId: questionId, position }
    })
  }

  const handleQuestionDrop = (event: React.DragEvent<HTMLDivElement>, questionId: string) => {
    event.preventDefault()
    event.stopPropagation()
    if (!draggedQuestionId || draggedQuestionId === questionId) {
      setDraggedQuestionId(null)
      setDragOverInfo(null)
      return
    }

    const position =
      dragOverInfo?.targetId === questionId ? dragOverInfo.position : 'before'
    reorderQuestions(draggedQuestionId, questionId, position)
    setDraggedQuestionId(null)
    setDragOverInfo(null)
  }

  const handleQuestionDragEnd = () => {
    setDraggedQuestionId(null)
    setDragOverInfo(null)
  }

  const handleQuestionListDropToEnd = (event: React.DragEvent<HTMLDivElement>) => {
    if (!draggedQuestionId) return
    event.preventDefault()
    reorderQuestions(draggedQuestionId, null, 'after')
    setDraggedQuestionId(null)
    setDragOverInfo(null)
  }


  // Persistence functions
  const persistCustomInstructions = (value: string) => {
    setCustomInstructions(value)
    try { localStorage.setItem('customInstructions', value) } catch {}
  }

  const persistIdea = (value: string) => {
    setIdea(value)
    try { localStorage.setItem('idea', value) } catch {}
  }

  const persistOpenaiApiKey = (value: string) => {
    setOpenaiApiKey(value)
    try { localStorage.setItem('openaiApiKey', value) } catch {}
  }

  const savePreviousBackground = (type: 'image' | 'video', url: string) => {
    const updated = { ...previousBackground, [type]: url }
    setPreviousBackground(updated)
    try { localStorage.setItem('previousBackground', JSON.stringify(updated)) } catch {}
  }


  // Stock media handlers
  const handleStockImageSelect = (image: any) => {
    updateBackground({ type: 'image', imageUrl: image.url })
    savePreviousBackground('image', image.url)
  }

  const handleStockVideoSelect = (video: any) => {
    updateBackground({ 
      ...quiz.background,
      type: 'video', 
      videoUrl: video.url 
    })
    savePreviousBackground('video', video.url)
  }

  const handleSplitScreenStockVideoSelect = (video: any) => {
    if (splitScreenStockMediaTarget === 'upper') {
      updateBackground({ 
        type: 'splitScreen', 
        splitScreen: true,
        upperVideoUrl: video.url,
        lowerVideoUrl: quiz.background.lowerVideoUrl || ''
      })
    } else {
      updateBackground({ 
        type: 'splitScreen', 
        splitScreen: true,
        upperVideoUrl: quiz.background.upperVideoUrl || '',
        lowerVideoUrl: video.url
      })
    }
  }

  const openStockMedia = (type: 'image' | 'video') => {
    setStockMediaType(type)
    setShowStockMedia(true)
  }

  const openSplitScreenStockMedia = (type: 'image' | 'video', target: 'upper' | 'lower') => {
    setSplitScreenStockMediaType(type)
    setSplitScreenStockMediaTarget(target)
    setShowSplitScreenStockMedia(true)
  }

  // Music handlers
  const handlePixabayMusicSelect = (music: any) => {
    console.log('Pixabay music selected in App:', music)
    updateSettings(s => ({ 
      ...s, 
      music: { 
        name: music.name, 
        url: music.url, 
        volume: s.music?.volume ?? 0.6 
      } 
    }))
    setShowPixabayMusic(false)
  }

  const handleTikTokMusicSelect = (music: any) => {
    updateSettings(s => ({ 
      ...s, 
      music: { 
        name: music.name, 
        url: music.url, 
        volume: s.music?.volume ?? 0.6 
      } 
    }))
    setShowTikTokMusic(false)
  }

  const handleFreesoundMusicSelect = (music: any) => {
    updateSettings(s => ({ 
      ...s, 
      music: { 
        name: music.name, 
        url: music.url, 
        volume: s.music?.volume ?? 0.6 
      } 
    }))
    setShowFreesoundMusic(false)
  }

  const handleLocalMusicSelect = (music: any) => {
    updateSettings(s => ({ 
      ...s, 
      music: { 
        name: music.name, 
        url: music.url, 
        volume: s.music?.volume ?? 0.6 
      } 
    }))
    setShowLocalMusic(false)
  }

  const handleYouTubeAudioSelect = (music: any) => {
    updateSettings(s => ({ 
      ...s, 
      music: { 
        name: music.name, 
        url: music.url, 
        volume: s.music?.volume ?? 0.6 
      } 
    }))
    setShowYouTubeAudio(false)
  }

  const handleRealMusicSelect = (music: any) => {
    updateSettings(s => ({ 
      ...s, 
      music: { 
        name: music.name, 
        url: music.url, 
        volume: s.music?.volume ?? 0.6 
      } 
    }))
    setShowRealMusic(false)
  }

  const handleMemeSelect = (meme: any) => {
    updateBackground({ 
      type: 'meme', 
      memeUrl: meme.url, 
      memeTitle: meme.title,
      isGif: meme.isGif || false
    })
    setShowMemeBackground(false)
  }

  // Meme handlers
  const handleMemeGenerate = (topText: string, bottomText: string) => {
    updateTopText(topText)
    updateBottomText(bottomText)
  }

  const handleMemeBackgroundChange = () => {
    // For memes, we'll use a separate stock media handler
    setStockMediaType('image')
    setShowStockMedia(true)
  }

  const handleMemeMusicChange = () => {
    // Open music modal for meme
    setShowRealMusic(true)
  }

  const handleStockMediaSelectForMeme = (media: any) => {
    if (media.type === 'image') {
      updateMemeBackground({ type: 'image', imageUrl: media.url })
    } else if (media.type === 'video') {
      updateMemeBackground({ type: 'video', videoUrl: media.url })
    }
    setShowStockMedia(false)
  }


  // Browser storage functions
  const saveSettingsToStorage = (settings: any) => {
    localStorage.setItem('quizSettings', JSON.stringify(settings))
  }

  const loadSettingsFromStorage = () => {
    const saved = localStorage.getItem('quizSettings')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        updateSettings(s => ({ ...s, ...parsed }))
      } catch (e) {
        console.error('Failed to load settings from storage:', e)
      }
    }
  }

  // Load settings on component mount
  React.useEffect(() => {
    loadSettingsFromStorage()
    
    // Migrate old answerWidth setting to answerWidthPercent
    const settings = quiz.settings as any
    if (settings?.answerWidth && !settings?.answerWidthPercent) {
      const oldWidth = settings.answerWidth
      const newPercent = Math.round((oldWidth / 800) * 100) // Convert 400px to 50%
      updateSettings(s => ({ 
        ...s, 
        answerWidthPercent: newPercent,
        answerWidth: undefined // Remove old setting
      }))
    }
  }, [])

  // Save settings whenever they change
  React.useEffect(() => {
    if (quiz.settings) {
      saveSettingsToStorage(quiz.settings)
    }
  }, [quiz.settings])

  // AI functions
  const generateQuestion = async () => {
    if (!openaiApiKey.trim()) {
      alert('Please enter your OpenAI API key first')
          return
        }
        
    if (!customInstructions.trim()) {
      alert('Please enter custom instructions for question generation')
          return
        }
        
    setIsGeneratingQuestion(true)
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `You are a quiz question generator. Generate multiple quiz questions based on the user's instructions. 

For each question, format it exactly like this:
Question: [The question text]
a) [First option]
b) [Second option] 
c) [Third option]

OR for true/false questions:
Question: [The question text]
a) True
b) False

 Append " (correct)" to the end of the correct answer option (for true/false, append it to the correct statement). Only one option per question should have this marker.

Separate each question with a blank line. Generate as many questions as requested in the instructions.`
            },
            {
              role: 'user',
              content: `Generate quiz questions based on these instructions: ${customInstructions}

${idea.trim() ? `Specific idea/topic: ${idea}` : ''}

Make sure to:
- Follow the exact format shown above
- Generate the number of questions requested in the instructions
- Use engaging, relatable questions
- Provide exactly 3 answer options (a, b, c) for multiple choice
- Use True/False format for true/false questions
- Keep the tone casual and social-media-friendly
- Make questions funny and exaggerated when appropriate
${idea.trim() ? '- Focus on the specific idea/topic provided above' : ''}`
            }
          ],
          max_tokens: 1000,
          temperature: 0.8
        })
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      const data = await response.json()
      const generatedContent = data.choices[0]?.message?.content?.trim()
      
      if (generatedContent) {
        // Parse multiple questions
        const questionBlocks = generatedContent.split(/\n\s*\n/).filter((block: string) => block.trim())
        
        let questionsAdded = 0
        
        const parseAnswer = (raw: string) => {
          const original = raw
          let text = raw.trim()
          let isCorrect = false

          const suffixPatterns = [
            /\s*\((?:correct answer|correct|right answer)\)\s*$/i,
            /\s*\[(?:correct answer|correct|right answer)\]\s*$/i,
            /\s*<\s*correct\s*>\s*$/i,
            /\s*\{\s*correct\s*\}\s*$/i,
            /\s*--?\s*correct\s*$/i,
            /\s*\*\s*correct\s*\*$/i
          ]
          for (const pattern of suffixPatterns) {
            if (pattern.test(text)) {
              text = text.replace(pattern, '').trim()
              isCorrect = true
              break
            }
          }

          if (!isCorrect) {
            const prefixPattern = /^\s*(?:correct answer:|correct:|answer:\s*)/i
            if (prefixPattern.test(text)) {
              text = text.replace(prefixPattern, '').trim()
              isCorrect = true
            }
          }

          return { text: text || original.trim(), isCorrect }
        }

        for (const block of questionBlocks) {
          const lines = (block as string).split('\n').map((l: string) => l.trim()).filter(Boolean)
          
          if (lines.length >= 4) {
            // Find the question line (starts with "Question:" or is the first line)
            let questionText = ''
            let answerLines: string[] = []
            
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].startsWith('Question:')) {
                questionText = lines[i].replace('Question:', '').trim()
                answerLines = lines.slice(i + 1)
                break
              } else if (i === 0 && !lines[i].startsWith('a)') && !lines[i].startsWith('b)') && !lines[i].startsWith('c)')) {
                questionText = lines[i]
                answerLines = lines.slice(i + 1)
                break
              }
            }
            
            if (questionText && answerLines.length >= 2) {
              const answerTexts: string[] = []
              
              for (let i = 0; i < Math.min(3, answerLines.length); i++) {
                const text = answerLines[i].replace(/^(?:[abc]\)|[abc]\.|-)?\s*(.+)$/i, '$1').trim()
                answerTexts.push(text)
              }
              
              if (answerTexts.length >= 2) {
                // Determine if it's a true/false question
                const isTrueFalse = answerTexts.length === 2 && 
                  (answerTexts[0].toLowerCase().includes('true') || answerTexts[1].toLowerCase().includes('true'))
                
                let question: QuizQuestion
                
                if (isTrueFalse) {
                  question = createBooleanQuestion(questionText) as QuizQuestion
                  const parsedAnswers = answerTexts.slice(0, 2).map(parseAnswer)
                  parsedAnswers.forEach((ans, idx) => {
                    question.answers[idx].text = ans.text
                  })
                  let correctIndex = parsedAnswers.findIndex(ans => ans.isCorrect)
                  if (correctIndex === -1) {
                    correctIndex = parsedAnswers.findIndex(ans => /^true\b/i.test(ans.text))
                  }
                  if (correctIndex === -1 && parsedAnswers.length === 2) {
                    const falseIndex = parsedAnswers.findIndex(ans => /^false\b/i.test(ans.text))
                    if (falseIndex !== -1) {
                      correctIndex = falseIndex === 0 ? 1 : 0
                    }
                  }
                  if (correctIndex === -1) correctIndex = 0
                  question.answers = [
                    { ...question.answers[0], isCorrect: correctIndex === 0 },
                    { ...question.answers[1], isCorrect: correctIndex === 1 }
                  ] as typeof question.answers
                } else {
                  question = createMultipleChoiceQuestion(questionText) as QuizQuestion
                  const parsedAnswers = answerTexts.slice(0, question.answers.length).map(parseAnswer)
                  parsedAnswers.forEach((ans, idx) => {
                    if (question.answers[idx]) {
                      question.answers[idx].text = ans.text
                    }
                  })
                  let correctIndex = parsedAnswers.findIndex(ans => ans.isCorrect)
                  if (correctIndex === -1) {
                    const letterMatch = parsedAnswers.findIndex(ans => /^correct\s*[.:]/i.test(ans.text))
                    if (letterMatch !== -1) {
                      correctIndex = letterMatch
                    }
                  }
                  if (correctIndex === -1) {
                    const markerMatch = parsedAnswers.findIndex(ans => /\b(correct answer|right answer)\b/i.test(ans.text))
                    if (markerMatch !== -1) {
                      correctIndex = markerMatch
                    }
                  }
                  if (correctIndex === -1) correctIndex = 0
                  question.answers = question.answers.map((ans, idx) => ({
                    ...ans,
                    isCorrect: idx === correctIndex
                  })) as typeof question.answers
                }
                
                addQuestion(question)
                questionsAdded++
              }
            }
          }
        }
        
        if (questionsAdded > 0) {
          alert(`Successfully generated ${questionsAdded} question${questionsAdded > 1 ? 's' : ''}!`)
        } else {
          alert('Failed to parse any questions from the response. Please try again.')
        }
      } else {
        alert('Failed to generate questions. Please try again.')
      }
    } catch (error) {
      console.error('Error generating questions:', error)
      alert(`Error generating questions: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsGeneratingQuestion(false)
    }
  }

  // Recording function
  const recordVideo = async () => {
    if (isRecording) return
    setIsRecording(true)
    setRecordingStatus('Initializing video recording...')
    setRecordingProgress(0)

    try {
      const totalDuration = computeExactDuration(quiz)
      const frameRate = 60

      const options: CanvasRecordingOptions = {
        quiz: { ...quiz, meme: quiz.settings?.animationType === 'meme' ? meme : undefined },
        duration: totalDuration,
        frameRate,
        quality: videoQuality,
        format: exportFormat,
        onProgress: (progress) => setRecordingProgress(progress),
        onStatus: (status) => setRecordingStatus(status),
        onError: (error) => {
          console.error('Canvas recording error:', error)
          setRecordingStatus(`Recording failed: ${error.message}`)
        setIsRecording(false)
        }
      }

      const result = await CanvasRecorder.recordVideo(options)
      CanvasRecorder.downloadVideo(result.blob, `quiz-export-${result.resolution}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${result.format}`)
      setRecordingStatus(`Recording complete! ${CanvasRecorder.formatFileSize(result.size)} - ${result.resolution}`)

        setTimeout(() => setRecordingStatus(''), 5000)
      setIsRecording(false)

    } catch (error) {
      console.error('Video recording failed:', error)
        setIsRecording(false)
      setRecordingStatus(`Recording failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        setTimeout(() => setRecordingStatus(''), 5000)
    }
  }

  // Helper functions
  function handleAnswerTextChange(q: QuizQuestion, answerId: string, text: string) {
    const updated: QuizQuestion = {
      ...q,
      answers: q.answers.map((a: any) => (a.id === answerId ? { ...a, text } : a)),
    } as QuizQuestion
    updateQuestion(updated)
  }

  function handleCorrectToggle(q: QuizQuestion, answerId: string, isCorrect: boolean) {
    const updated: QuizQuestion = {
      ...q,
      answers: q.answers.map((a: any) => ({ ...a, isCorrect: a.id === answerId ? isCorrect : a.isCorrect })),
    } as QuizQuestion
    updateQuestion(updated)
  }

  const deleteAllQuestions = useCallback(() => {
    if (quiz.questions.length === 0) return
    if (!confirm('Delete all questions?')) return
    quiz.questions.forEach(q => removeQuestion(q.id))
    setSelectedQuestionId(null)
  }, [quiz.questions, removeQuestion])

  async function handleSaveJson() {
    const contents = toJsonString()
    const blob = new Blob([contents], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'quiz.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleLoadJson(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result)
      loadFromJsonString(text)
    }
    reader.readAsText(file)
  }

  return (
    <div className="min-h-screen bg-iosbg text-iostext">
      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Editor */}
        <div className="ios-card p-4 h-[85vh] overflow-y-auto scroll-thin">
          <h2 className="text-lg font-semibold mb-4">Editor</h2>
          
          {/* Save/Load */}
          <div className="mb-4 flex items-center gap-2">
            <button className="ios-card px-3 py-2" onClick={handleSaveJson}>Save JSON</button>
            <label className="ios-card px-3 py-2 cursor-pointer">
              Load JSON
              <input type="file" accept="application/json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleLoadJson(f) }} />
            </label>
          </div>

          {/* Tab Navigation */}
          <div className="flex mb-4 bg-gray-100/20 rounded-lg p-1">
            <button
              className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                activeTab === 'settings' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab('settings')}
            >
              ⚙️ Settings
            </button>
            <button
              className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                activeTab === 'questions' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab('questions')}
            >
              ❓ Questions & AI
            </button>
            <button
              className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                activeTab === 'meme' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab('meme')}
            >
              😂 Meme Generator
            </button>
            <button
              className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                activeTab === 'overlay' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab('overlay')}
            >
              🖋 Overlay Text
            </button>
          </div>

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              {/* Background */}
              <div className="bg-gray-100/20 rounded-lg p-3">
                <div className="text-sm font-medium text-gray-300 mb-3">🎨 Background</div>
                
                {/* Background Type Selection */}
                <div className="flex items-center gap-2 mb-3">
              <select
                className="ios-input"
                value={quiz.background.type}
                onChange={e => {
                  const type = e.target.value as QuizData['background']['type']
                  if (type === 'color') updateBackground({ type, color: quiz.background.color ?? '#0b0b0c' })
                  if (type === 'image') updateBackground({ type, imageUrl: '' })
                  if (type === 'video') updateBackground({ type, videoUrl: '', videoStartOffsetSeconds: quiz.background.videoStartOffsetSeconds ?? 0 })
                  if (type === 'meme') updateBackground({ type, memeUrl: '', memeTitle: '' })
                  if (type === 'splitScreen') updateBackground({ type, splitScreen: true, upperVideoUrl: '', lowerVideoUrl: '' })
                }}
              >
                <option value="color">Color</option>
                <option value="image">Image (upload)</option>
                <option value="video">Video (upload)</option>
                <option value="meme">Meme (API)</option>
                <option value="splitScreen">Split Screen (2 videos)</option>
              </select>
              {quiz.background.type === 'color' && (
                <input type="color" value={quiz.background.color ?? '#0b0b0c'} onChange={e => updateBackground({ type: 'color', color: e.target.value })} />
              )}
            </div>

                {/* Animation Type & Aspect Ratio */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <div className="text-sm text-iossub mb-1">Animation Type</div>
                    <select
                      className="ios-input w-full"
                      value={quiz.settings?.animationType || 'quiz'}
                      onChange={e => updateSettings(s => {
                        const animationType = e.target.value as 'quiz' | 'meme' | 'overlay'
                        const next: QuizSettings = { ...s, animationType }
                        if (animationType === 'overlay') {
                          const currentOverlay: OverlaySettings = s.overlay ?? { enabled: false, items: [] }
                          next.overlay = { ...currentOverlay, enabled: true }
                        }
                        return next
                      })}
                    >
                      <option value="quiz">Quiz</option>
                      <option value="meme">Meme</option>
                      <option value="overlay">Text Overlay</option>
                    </select>
                  </div>
                </div>

                {/* Background Overlay */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-sm text-iossub mb-1">Overlay Color</label>
                    <input
                      type="color"
                      className="ios-input w-full h-10"
                      value={quiz.settings?.bgOverlayColor ?? '#000000'}
                      onChange={e => updateSettings(s => ({ ...s, bgOverlayColor: e.target.value }))}
                    />
                  </div>
                  <div>
                    <LabeledSlider 
                      label="Overlay Opacity" 
                      value={quiz.settings?.bgOverlayOpacity ?? 0} 
                      min={0} 
                      max={1} 
                      step={0.01} 
                      onChange={v => updateSettings(s => ({ ...s, bgOverlayOpacity: v }))} 
                    />
                  </div>
            </div>
            {quiz.background.type === 'image' && (
              <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="ios-card px-3 py-2 cursor-pointer text-sm text-iossub">
                  {quiz.background.imageUrl ? 'Change image' : 'Upload image'}
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    const url = URL.createObjectURL(f)
                    updateBackground({ type: 'image', imageUrl: url })
                      savePreviousBackground('image', url)
                  }} />
                </label>
                  <button 
                    className="ios-card px-3 py-2 text-sm" 
                    onClick={() => openStockMedia('image')}
                  >
                    📸 Stock Images
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {previousBackground.image && (
                    <button 
                      className="ios-card px-3 py-2 text-sm" 
                      onClick={() => updateBackground({ type: 'image', imageUrl: previousBackground.image! })}
                    >
                      Use Previous
                    </button>
                  )}
                {quiz.background.imageUrl && (
                  <button className="ios-card px-3 py-2" onClick={() => updateBackground({ type: 'image', imageUrl: '' })}>Clear</button>
                )}
                </div>
                <div className="mt-3 space-y-3 border border-iosborder/60 rounded-lg p-3 bg-black/10">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={quiz.settings?.bgZoomEnabled ?? false}
                      onChange={e => updateSettings(s => ({ ...s, bgZoomEnabled: e.target.checked }))}
                    />
                    Enable zoom animation
                  </label>
                  {quiz.settings?.bgZoomEnabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <LabeledSlider
                        label="Zoom Amount (x)"
                        value={quiz.settings?.bgZoomScale ?? 1.1}
                        min={1}
                        max={2}
                        step={0.01}
                        onChange={v => updateSettings(s => ({ ...s, bgZoomScale: v }))}
                      />
                      <LabeledSlider
                        label="Zoom Duration (ms)"
                        value={quiz.settings?.bgZoomDurationMs ?? 6000}
                        min={500}
                        max={20000}
                        step={100}
                        onChange={v => updateSettings(s => ({ ...s, bgZoomDurationMs: v }))}
                      />
                    </div>
                )}
                </div>
              </div>
            )}
            {quiz.background.type === 'video' && (
              <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="ios-card px-3 py-2 cursor-pointer text-sm text-iossub">
                  {quiz.background.videoUrl ? 'Change video' : 'Upload video'}
                  <input type="file" accept="video/*" className="hidden" onChange={e => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    const url = URL.createObjectURL(f)
                    updateBackground({ 
                      ...quiz.background,
                      type: 'video', 
                      videoUrl: url 
                    })
                      savePreviousBackground('video', url)
                  }} />
                </label>
                  <button 
                    className="ios-card px-3 py-2 text-sm" 
                    onClick={() => openStockMedia('video')}
                  >
                    🎬 Stock Videos
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {previousBackground.video && (
                    <button 
                      className="ios-card px-3 py-2 text-sm" 
                      onClick={() => updateBackground({ 
                        ...quiz.background,
                        type: 'video', 
                        videoUrl: previousBackground.video! 
                      })}
                    >
                      Use Previous
                    </button>
                  )}
                {quiz.background.videoUrl && (
                  <button className="ios-card px-3 py-2" onClick={() => updateBackground({ 
                    ...quiz.background,
                    type: 'video', 
                    videoUrl: '' 
                  })}>Clear</button>
                )}
                </div>
                <LabeledSlider 
                  label="Start Offset (s)" 
                  value={quiz.background.videoStartOffsetSeconds ?? 0} 
                  min={0} 
                  max={120} 
                  step={0.1} 
                  onChange={v => updateBackground({ 
                    ...quiz.background, 
                    type: 'video', 
                    videoStartOffsetSeconds: Number.isFinite(v) ? v : 0 
                  })} 
                />
              </div>
            )}
            {quiz.background.type === 'meme' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <button 
                    className="ios-card px-3 py-2 text-sm" 
                    onClick={() => setShowMemeBackground(true)}
                  >
                    🎭 Browse Memes
                  </button>
                  {quiz.background.memeUrl && (
                    <button 
                      className="ios-card px-3 py-2 text-sm" 
                      onClick={() => setShowMemeBackground(true)}
                    >
                      Change Meme
                    </button>
                  )}
                </div>
                {quiz.background.memeUrl && (
                  <div className="space-y-2">
                    <div className="text-sm text-iossub">
                      <strong>Current Meme:</strong> {quiz.background.memeTitle || 'Untitled'}
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="ios-card px-3 py-2" onClick={() => updateBackground({ type: 'meme', memeUrl: '', memeTitle: '' })}>
                        Clear Meme
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {quiz.background.type === 'splitScreen' && (
              <div className="space-y-3">
                <div className="text-sm text-iossub mb-2">Upload two videos for split screen</div>
                
                {/* Upper Video */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-300">Upper Half Video</div>
                  <div className="flex items-center gap-2">
                    <label className="ios-card px-3 py-2 cursor-pointer text-sm text-iossub">
                      {quiz.background.upperVideoUrl ? 'Change upper video' : 'Upload upper video'}
                      <input type="file" accept="video/*" className="hidden" onChange={e => {
                        const f = e.target.files?.[0]
                        if (!f) return
                        const url = URL.createObjectURL(f)
                        updateBackground({ 
                          type: 'splitScreen', 
                          splitScreen: true,
                          upperVideoUrl: url,
                          lowerVideoUrl: quiz.background.lowerVideoUrl || ''
                        })
                      }} />
                    </label>
                    <button 
                      className="ios-card px-3 py-2 text-sm" 
                      onClick={() => openSplitScreenStockMedia('video', 'upper')}
                    >
                      🎬 Stock Videos
                    </button>
                    {quiz.background.upperVideoUrl && (
                      <button className="ios-card px-3 py-2" onClick={() => updateBackground({ 
                        type: 'splitScreen', 
                        splitScreen: true,
                        upperVideoUrl: '',
                        lowerVideoUrl: quiz.background.lowerVideoUrl || ''
                      })}>
                        Clear Upper
                      </button>
                    )}
                  </div>
                </div>

                {/* Lower Video */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-300">Lower Half Video</div>
                  <div className="flex items-center gap-2">
                    <label className="ios-card px-3 py-2 cursor-pointer text-sm text-iossub">
                      {quiz.background.lowerVideoUrl ? 'Change lower video' : 'Upload lower video'}
                      <input type="file" accept="video/*" className="hidden" onChange={e => {
                        const f = e.target.files?.[0]
                        if (!f) return
                        const url = URL.createObjectURL(f)
                        updateBackground({ 
                          type: 'splitScreen', 
                          splitScreen: true,
                          upperVideoUrl: quiz.background.upperVideoUrl || '',
                          lowerVideoUrl: url
                        })
                      }} />
                    </label>
                    <button 
                      className="ios-card px-3 py-2 text-sm" 
                      onClick={() => openSplitScreenStockMedia('video', 'lower')}
                    >
                      🎬 Stock Videos
                    </button>
                    {quiz.background.lowerVideoUrl && (
                      <button className="ios-card px-3 py-2" onClick={() => updateBackground({ 
                        type: 'splitScreen', 
                        splitScreen: true,
                        upperVideoUrl: quiz.background.upperVideoUrl || '',
                        lowerVideoUrl: ''
                      })}>
                        Clear Lower
                      </button>
                    )}
                  </div>
                </div>

                {/* Clear All */}
                {(quiz.background.upperVideoUrl || quiz.background.lowerVideoUrl) && (
                  <div className="flex items-center gap-2">
                    <button className="ios-card px-3 py-2" onClick={() => updateBackground({ 
                      type: 'splitScreen', 
                      splitScreen: true,
                      upperVideoUrl: '',
                      lowerVideoUrl: ''
                    })}>
                      Clear All Videos
                    </button>
                  </div>
                )}
              </div>
            )}
              </div>

              {/* CTA Settings */}
              <div className="bg-gray-100/20 rounded-lg p-3">
                <div className="text-sm font-medium text-gray-300 mb-3">📢 Call-to-Action Screen</div>
                
                <div className="flex items-center gap-2 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={currentCTA.enabled}
                      onChange={e => applyCTAUpdate(cta => ({ ...cta, enabled: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-300">Show CTA screen after completion</span>
                  </label>
                </div>

                {currentCTA.enabled && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3">
                      <LabeledSlider 
                        label="CTA Duration (ms)" 
                        value={currentCTA.durationMs}
                        min={1000} 
                        max={10000} 
                        onChange={v => applyCTAUpdate(cta => ({ ...cta, durationMs: v }))}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="text-sm text-gray-300">Background Source</div>
                      <div className="flex items-center gap-2 mb-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="ctaBackground"
                            checked={currentCTA.useSameBackground}
                            onChange={() => applyCTAUpdate(cta => ({ ...cta, useSameBackground: true, backgroundVideoUrl: undefined, imageUrl: undefined, backgroundType: 'video' }))}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-300">Use same background as quiz/meme</span>
                        </label>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="ctaBackground"
                            checked={!currentCTA.useSameBackground && currentCTA.backgroundType === 'video'}
                            onChange={() => applyCTAUpdate(cta => ({ ...cta, useSameBackground: false, backgroundType: 'video', imageUrl: undefined }))}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-300">Use custom CTA video</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="ctaBackground"
                            checked={!currentCTA.useSameBackground && currentCTA.backgroundType === 'image'}
                            onChange={() => applyCTAUpdate(cta => ({ ...cta, useSameBackground: false, backgroundType: 'image', backgroundVideoUrl: undefined }))}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-300">Use custom CTA image</span>
                        </label>
                      </div>

                        {!currentCTA.useSameBackground && currentCTA.backgroundType === 'video' && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <label className="ios-card px-3 py-2 cursor-pointer text-sm text-iossub">
                              {currentCTA.backgroundVideoUrl ? 'Change CTA video' : 'Upload CTA video'}
                              <input
                                type="file"
                                accept="video/*"
                                className="hidden"
                                onChange={e => {
                                  const file = e.target.files?.[0]
                                  if (!file) return
                                  const url = URL.createObjectURL(file)
                                  applyCTAUpdate(cta => ({ ...cta, backgroundVideoUrl: url, imageUrl: undefined, useSameBackground: false, backgroundType: 'video' }))
                                }}
                              />
                            </label>
                            {currentCTA.backgroundVideoUrl && (
                              <button 
                                className="ios-card px-3 py-2" 
                                onClick={() => applyCTAUpdate(cta => ({ ...cta, backgroundVideoUrl: undefined }))}
                              >
                                Clear CTA Video
                              </button>
                            )}
                          </div>
                          {currentCTA.backgroundVideoUrl && (
                            <div className="text-xs text-iossub">
                              CTA video loaded successfully
                            </div>
                          )}
                        </div>
                      )}

                        {!currentCTA.useSameBackground && currentCTA.backgroundType === 'image' && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <label className="ios-card px-3 py-2 cursor-pointer text-sm text-iossub">
                              {currentCTA.imageUrl ? 'Change CTA image' : 'Upload CTA image'}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => {
                                  const file = e.target.files?.[0]
                                  if (!file) return
                                  const url = URL.createObjectURL(file)
                                  applyCTAUpdate(cta => ({ ...cta, imageUrl: url, backgroundVideoUrl: undefined, useSameBackground: false, backgroundType: 'image' }))
                                }}
                              />
                            </label>
                            {currentCTA.imageUrl && (
                              <button
                                className="ios-card px-3 py-2"
                                onClick={() => applyCTAUpdate(cta => ({ ...cta, imageUrl: undefined }))}
                              >
                                Clear CTA Image
                              </button>
                            )}
                          </div>
                          {currentCTA.imageUrl && (
                            <div className="text-xs text-iossub">
                              CTA image loaded successfully
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="text-sm text-gray-300">CTA Text</div>
                        <TransparentTextarea
                          placeholder="Enter CTA text... (use Shift+Enter for line breaks)"
                          value={currentCTA.text ?? ''}
                          onChange={value => applyCTAUpdate(cta => ({ ...cta, text: value }))}
                          className="ios-input w-full"
                          rows={3}
                        />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <div className="text-sm text-iossub">Font Family</div>
                          <select
                            className="ios-input w-full"
                            value={currentCTA.fontFamily}
                            onChange={e => applyCTAUpdate(cta => ({ ...cta, fontFamily: e.target.value }))}
                          >
                            {fontOptions.map(font => (
                              <option key={font} value={font}>
                                {font}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                        <LabeledSlider 
                          label="Text Size %" 
                            value={currentCTA.textSizePercent ?? 8}
                          min={2} 
                          max={20} 
                            onChange={v => applyCTAUpdate(cta => ({ ...cta, textSizePercent: v }))}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <div className="text-sm text-iossub">Text Color</div>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={currentCTA.textColor}
                              onChange={e => applyCTAUpdate(cta => ({ ...cta, textColor: e.target.value }))}
                              className="w-12 h-8 rounded border border-gray-300 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={currentCTA.textColor}
                              onChange={e => applyCTAUpdate(cta => ({ ...cta, textColor: e.target.value }))}
                              className="ios-input flex-1"
                              placeholder="#FFFFFF"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="flex items-center gap-2 text-iossub">
                            <input
                              type="checkbox"
                              checked={currentCTA.textShadowEnabled}
                              onChange={e => applyCTAUpdate(cta => ({ ...cta, textShadowEnabled: e.target.checked }))}
                              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                            />
                            Enable text shadow
                          </label>
                          {currentCTA.textShadowEnabled && (
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={currentCTA.textShadowColor}
                                onChange={e => applyCTAUpdate(cta => ({ ...cta, textShadowColor: e.target.value }))}
                                className="w-12 h-8 rounded border border-gray-300 cursor-pointer"
                              />
                              <input
                                type="text"
                                value={currentCTA.textShadowColor}
                                onChange={e => applyCTAUpdate(cta => ({ ...cta, textShadowColor: e.target.value }))}
                                className="ios-input flex-1"
                                placeholder="#000000"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <LabeledSlider 
                          label="Fade In (ms)" 
                          value={currentCTA.fadeInMs ?? 600}
                          min={200} 
                          max={2000} 
                          onChange={v => applyCTAUpdate(cta => ({ ...cta, fadeInMs: v }))}
                        />
                        <LabeledSlider 
                          label="Hold (ms)" 
                          value={currentCTA.holdMs ?? 1800}
                          min={500} 
                          max={5000} 
                          onChange={v => applyCTAUpdate(cta => ({ ...cta, holdMs: v }))}
                        />
                      </div>
                      </div>

                      <div className="space-y-3">
                        <div className="text-sm text-gray-300">Video Overlay</div>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                          checked={currentCTA.overlayEnabled}
                          onChange={e => applyCTAUpdate(cta => ({ ...cta, overlayEnabled: e.target.checked }))}
                              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-300">Enable video overlay</span>
                          </label>

                      {currentCTA.overlayEnabled && (
                          <div className="space-y-3">
                          <div className="space-y-1">
                            <div className="text-sm text-iossub">Overlay Color</div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                value={currentCTA.overlayColor ?? '#000000'}
                                onChange={e => applyCTAUpdate(cta => ({ ...cta, overlayColor: e.target.value }))}
                                  className="w-12 h-8 rounded border border-gray-300 cursor-pointer"
                                />
                                <input
                                  type="text"
                                value={currentCTA.overlayColor ?? '#000000'}
                                onChange={e => applyCTAUpdate(cta => ({ ...cta, overlayColor: e.target.value }))}
                                  className="ios-input flex-1"
                                  placeholder="#000000"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                              <LabeledSlider 
                                label="Overlay Opacity" 
                              value={Math.round((currentCTA.overlayOpacity ?? 0.4) * 100)}
                                min={0} 
                                max={100} 
                              onChange={v => applyCTAUpdate(cta => ({ ...cta, overlayOpacity: v / 100 }))}
                              />
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                )}
              </div>

              {/* Music Settings */}
              <div className="bg-gray-100/20 rounded-lg p-3">
                <div className="text-sm font-medium text-gray-300 mb-3">🎵 Music</div>
                <div className="space-y-3">
            <div>
                    <div className="text-sm text-iossub mb-2">Music Source</div>
                    <div className="space-y-2">
              <label className="ios-card px-3 py-2 block text-sm cursor-pointer text-iossub">
                        {quiz.settings?.music?.name ?? 'Upload Music File'}
                <input type="file" accept="audio/*" className="hidden" onChange={e => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  const url = URL.createObjectURL(f)
                  updateSettings(s => ({ ...s, music: { name: f.name, url, volume: s.music?.volume ?? 0.6 } }))
                }} />
              </label>
                      <button 
                        className="ios-card px-3 py-2 block text-sm text-iossub w-full"
                        onClick={() => setShowPixabayMusic(true)}
                      >
                        🎼 Browse Pixabay Music
                      </button>
                      <button 
                        className="ios-card px-3 py-2 block text-sm text-iossub w-full"
                        onClick={() => setShowTikTokMusic(true)}
                      >
                        🎵 Browse TikTok Music
                      </button>
                      <button 
                        className="ios-card px-3 py-2 block text-sm text-iossub w-full"
                        onClick={() => setShowFreesoundMusic(true)}
                      >
                        🔊 Browse Freesound Music
                      </button>
                      <button 
                        className="ios-card px-3 py-2 block text-sm text-iossub w-full"
                        onClick={() => setShowYouTubeAudio(true)}
                      >
                        🎵 Free Music Library
                      </button>
                      <button 
                        className="ios-card px-3 py-2 block text-sm text-iossub w-full"
                        onClick={() => setShowRealMusic(true)}
                      >
                        🎼 Real Music Library
                      </button>
                      <button 
                        className="ios-card px-3 py-2 block text-sm text-iossub w-full"
                        onClick={() => setShowLocalMusic(true)}
                      >
                        📁 Upload Local File
                      </button>
                      <button 
                        className="ios-card px-3 py-2 block text-sm text-iossub w-full"
                        onClick={() => {
                          const testUrl = createTestAudio(10)
                          updateSettings(s => ({ 
                            ...s, 
                            music: { 
                              name: 'Test Audio', 
                              url: testUrl, 
                              volume: s.music?.volume ?? 0.6 
                            } 
                          }))
                        }}
                      >
                        🧪 Test Audio (10s)
                      </button>
                    </div>
                  </div>
                  {quiz.settings?.music?.url && (
                  <div className="space-y-3">
                      <LabeledSlider 
                        label="Music Volume" 
                        value={quiz.settings.music.volume} 
                        min={0} 
                        max={1} 
                        step={0.01} 
                        onChange={v => updateSettings(s => ({ ...s, music: { ...s.music!, volume: v } }))} 
                      />
                    <LabeledSlider 
                      label="Start Offset (s)" 
                      value={quiz.settings.music.startOffsetSeconds ?? 0} 
                      min={0} 
                      max={120} 
                      step={0.1} 
                      onChange={v => updateSettings(s => ({ ...s, music: { ...s.music!, startOffsetSeconds: Number.isFinite(v) ? v : 0 } }))} 
                      />
                    </div>
                  )}
            </div>
          </div>

              {/* Volume Settings */}
              <div className="bg-gray-100/20 rounded-lg p-3">
                <div className="text-sm font-medium text-gray-300 mb-3">🔊 Volume</div>
                <div className="grid grid-cols-2 gap-3">
                  <LabeledSlider label="SFX appear" value={quiz.settings!.sfx.appearVolume} min={0} max={1} step={0.01} onChange={v => updateSettings(s => ({ ...s, sfx: { ...s.sfx, appearVolume: v } }))} />
                  <LabeledSlider label="SFX correct" value={quiz.settings!.sfx.correctVolume} min={0} max={1} step={0.01} onChange={v => updateSettings(s => ({ ...s, sfx: { ...s.sfx, correctVolume: v } }))} />
            </div>
          </div>

            </div>
          )}

          {activeTab === 'overlay' && (
            <div className="space-y-4">
              <div className="bg-gray-100/20 rounded-lg p-3">
                <div className="text-sm font-medium text-gray-300 mb-3">🖋 Overlay Text Blocks</div>

                <label className="flex items-center gap-2 text-sm mb-3">
                  <input
                    type="checkbox"
                    checked={currentOverlay.enabled}
                    onChange={e => applyOverlayUpdate(o => ({ ...o, enabled: e.target.checked }))}
                  />
                  Enable overlay text
                </label>

                {currentOverlay.enabled && (
                  <div className="space-y-4">
                    <button className="ios-card px-3 py-2 text-sm" onClick={handleAddOverlay}>
                      + Add Overlay Block
                    </button>

                    {currentOverlay.items.length === 0 && (
                      <div className="text-sm text-iossub">No overlay blocks added yet.</div>
                    )}

                    {currentOverlay.items.map((item, index) => (
                      <div key={item.id} className="ios-card p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium text-gray-300">
                            Overlay #{index + 1}
                </div>
                          <button
                            className="text-red-400 text-xs"
                            onClick={() => removeOverlayItem(item.id)}
                          >
                            Delete
                          </button>
                        </div>

                        <TransparentTextarea
                          className="ios-input w-full min-h-[80px] resize-y"
                          value={item.text}
                          onChange={value => updateOverlayItem(item.id, overlay => ({ ...overlay, text: value }))}
                          placeholder="Enter overlay text... (Shift+Enter for line breaks)"
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <div className="text-sm text-iossub mb-1">Font Family</div>
                            <select
                              className="ios-input w-full"
                              value={item.fontFamily ?? quiz.settings?.fontFamily ?? 'Impact'}
                              onChange={e => updateOverlayItem(item.id, overlay => ({ ...overlay, fontFamily: e.target.value }))}
                            >
                              {fontOptions.map(font => (
                                <option key={font} value={font}>{font}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <LabeledSlider
                              label="Font Size %"
                              value={item.fontSizePercent ?? 4}
                              min={2}
                              max={20}
                              step={0.5}
                              onChange={v => updateOverlayItem(item.id, overlay => ({ ...overlay, fontSizePercent: v }))}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <div className="text-sm text-iossub">Text Color</div>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={item.textColor ?? '#ffffff'}
                                onChange={e => updateOverlayItem(item.id, overlay => ({ ...overlay, textColor: e.target.value }))}
                                className="w-12 h-8 rounded border border-gray-300 cursor-pointer"
                              />
                              <input
                                type="text"
                                value={item.textColor ?? '#ffffff'}
                                onChange={e => updateOverlayItem(item.id, overlay => ({ ...overlay, textColor: e.target.value }))}
                                className="ios-input flex-1"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-sm text-iossub">Background Color</div>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={item.backgroundColor ?? '#000000'}
                                onChange={e => updateOverlayItem(item.id, overlay => ({ ...overlay, backgroundColor: e.target.value }))}
                                className="w-12 h-8 rounded border border-gray-300 cursor-pointer"
                              />
                              <input
                                type="text"
                                value={item.backgroundColor ?? '#000000'}
                                onChange={e => updateOverlayItem(item.id, overlay => ({ ...overlay, backgroundColor: e.target.value }))}
                                className="ios-input flex-1"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <LabeledSlider
                            label="Background Opacity"
                            value={item.backgroundOpacity ?? 0.7}
                            min={0}
                            max={1}
                            step={0.01}
                            onChange={v => updateOverlayItem(item.id, overlay => ({ ...overlay, backgroundOpacity: v }))}
                          />
                          <LabeledSlider
                            label="Padding (px)"
                            value={item.padding ?? 12}
                            min={0}
                            max={80}
                            step={1}
                            onChange={v => updateOverlayItem(item.id, overlay => ({ ...overlay, padding: v }))}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <div className="text-sm text-iossub mb-1">Horizontal Alignment</div>
                            <select
                              className="ios-input w-full"
                              value={item.align ?? 'center'}
                              onChange={e => updateOverlayItem(item.id, overlay => ({ ...overlay, align: e.target.value as OverlayHorizontalAlign }))}
                            >
                              {overlayAlignOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <div className="text-sm text-iossub mb-1">Vertical Position</div>
                            <select
                              className="ios-input w-full"
                              value={item.verticalPosition ?? 'center'}
                              onChange={e => updateOverlayItem(item.id, overlay => ({ ...overlay, verticalPosition: e.target.value as OverlayVerticalPosition }))}
                            >
                              {overlayVerticalOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <LabeledSlider
                            label="Start Offset (ms)"
                            value={item.startOffsetMs ?? 0}
                            min={0}
                            max={60000}
                            step={100}
                            onChange={v => updateOverlayItem(item.id, overlay => ({ ...overlay, startOffsetMs: v }))}
                          />
                          <LabeledSlider
                            label="Display Duration (ms)"
                            value={item.displayDurationMs ?? 2000}
                            min={500}
                            max={60000}
                            step={100}
                            onChange={v => updateOverlayItem(item.id, overlay => ({ ...overlay, displayDurationMs: v }))}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <div className="text-sm text-iossub mb-1">Animation In</div>
                            <select
                              className="ios-input w-full"
                              value={item.animationIn ?? 'fade'}
                              onChange={e => updateOverlayItem(item.id, overlay => ({ ...overlay, animationIn: e.target.value as OverlayAnimation }))}
                            >
                              {overlayAnimationOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <div className="text-sm text-iossub mb-1">Animation Out</div>
                            <select
                              className="ios-input w-full"
                              value={item.animationOut ?? item.animationIn ?? 'fade'}
                              onChange={e => updateOverlayItem(item.id, overlay => ({ ...overlay, animationOut: e.target.value as OverlayAnimation }))}
                            >
                              {overlayAnimationOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <LabeledSlider
                            label="Animation In Duration (ms)"
                            value={item.animationInDurationMs ?? 500}
                            min={0}
                            max={5000}
                            step={50}
                            onChange={v => updateOverlayItem(item.id, overlay => ({ ...overlay, animationInDurationMs: v }))}
                          />
                          <LabeledSlider
                            label="Animation Out Duration (ms)"
                            value={item.animationOutDurationMs ?? 500}
                            min={0}
                            max={5000}
                            step={50}
                            onChange={v => updateOverlayItem(item.id, overlay => ({ ...overlay, animationOutDurationMs: v }))}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Questions Tab */}
          {activeTab === 'questions' && (
            <div className="space-y-4">
              {/* Quiz Title */}
              <div className="bg-gray-100/20 rounded-lg p-3">
                <div className="text-sm font-medium text-gray-300 mb-3">📝 Quiz Title</div>
                <TransparentTextarea 
                  className="ios-input w-full mb-2 min-h-[60px] resize-y" 
                  value={quiz.title} 
                  onChange={updateTitle} 
                  placeholder="Your Quiz Title&#10;Use Enter for line breaks" 
                  rows={2}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input 
                    type="checkbox" 
                    checked={quiz.settings?.showTitle ?? true} 
                    onChange={e => updateSettings(s => ({ ...s, showTitle: e.target.checked }))} 
                  />
                  Show title
                </label>
              </div>

              {/* AI Question Generator */}
              <div className="bg-gray-100/20 rounded-lg p-3">
                <div className="text-sm font-medium text-gray-300 mb-3">🤖 AI Question Generator</div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-iossub mb-1">💡 Specific Idea/Topic (Optional)</label>
                    <TransparentTextarea
                      className="ios-input w-full min-h-[60px] resize-y"
                      value={idea}
                      onChange={persistIdea}
                      placeholder="Enter a specific idea or topic for your questions (e.g., 'workplace stress', 'social media habits', 'cooking disasters')"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <button 
                      className="ios-card px-3 py-2 w-full text-sm" 
                      onClick={() => setShowAIModal(true)}
                    >
                      ⚙️ Custom Instructions
                    </button>
                    <button 
                      className="ios-card px-3 py-2 w-full disabled:opacity-50 text-sm" 
                      onClick={generateQuestion}
                      disabled={isGeneratingQuestion || !openaiApiKey.trim() || !customInstructions.trim()}
                    >
                      {isGeneratingQuestion ? '🔄 Generating...' : '✨ Generate Questions'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Answer Format Settings */}
              <div className="bg-gray-100/20 rounded-lg p-3">
                <div className="text-sm font-medium text-gray-300 mb-3">📝 Answer Format</div>
            <div className="flex gap-2">
                  <button
                    className={`px-3 py-2 rounded text-sm ${
                      (quiz.settings!.answerFormat ?? 'letters') === 'letters' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700'
                    }`}
                    onClick={() => updateSettings(s => ({ ...s, answerFormat: 'letters' }))}
                  >
                    a), b), c)
                  </button>
                  <button
                    className={`px-3 py-2 rounded text-sm ${
                      (quiz.settings!.answerFormat ?? 'letters') === 'numbers' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700'
                    }`}
                    onClick={() => updateSettings(s => ({ ...s, answerFormat: 'numbers' }))}
                  >
                    1), 2), 3)
                  </button>
                  <button
                    className={`px-3 py-2 rounded text-sm ${
                      (quiz.settings!.answerFormat ?? 'letters') === 'steps' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700'
                    }`}
                    onClick={() => updateSettings(s => ({ ...s, answerFormat: 'steps' }))}
                    >
                      Step 1:, 2:, 3:
                    </button>
            </div>
          </div>

              {/* Correct Answer Styling */}
              <div className="bg-gray-100/20 rounded-lg p-3">
                <div className="text-sm font-medium text-gray-300 mb-3">🎯 Correct Answer Styling</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-iossub mb-1">Button Color</label>
                    <input
                      type="color"
                      className="ios-input w-full h-10"
                      value={quiz.settings?.correctAnswerButtonColor ?? quiz.settings?.correctAnswerColor ?? '#10b981'}
                      onChange={e =>
                        updateSettings(s => ({
                          ...s,
                          correctAnswerButtonColor: e.target.value,
                          correctAnswerColor: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-iossub mb-1">Text Color</label>
                    <input
                      type="color"
                      className="ios-input w-full h-10"
                      value={quiz.settings?.correctAnswerTextColor ?? '#ffffff'}
                      onChange={e =>
                        updateSettings(s => ({
                          ...s,
                          correctAnswerTextColor: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Quiz Timing */}
              <div className="bg-gray-100/20 rounded-lg p-3">
                <div className="text-sm font-medium text-gray-300 mb-3">⏱️ Quiz Timing</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <LabeledSlider label="Title in" value={quiz.settings!.titleInMs} min={200} max={2000} onChange={v => updateSettings(s => ({ ...s, titleInMs: v }))} />
                  <LabeledSlider label="Title hold" value={quiz.settings!.titleHoldMs} min={200} max={3000} onChange={v => updateSettings(s => ({ ...s, titleHoldMs: v }))} />
                  <LabeledSlider label="Title out" value={quiz.settings!.titleOutMs} min={200} max={2000} onChange={v => updateSettings(s => ({ ...s, titleOutMs: v }))} />
                  <LabeledSlider label="Question in" value={quiz.settings!.questionInMs} min={0} max={2000} onChange={v => updateSettings(s => ({ ...s, questionInMs: v }))} />
                  <LabeledSlider label="Question hold" value={quiz.settings!.questionHoldMs} min={200} max={6000} onChange={v => updateSettings(s => ({ ...s, questionHoldMs: v }))} />
                  <LabeledSlider label="Answers stagger" value={quiz.settings!.answersStaggerMs} min={50} max={2000} onChange={v => updateSettings(s => ({ ...s, answersStaggerMs: v }))} />
                  <LabeledSlider label="Correct reveal" value={quiz.settings!.correctRevealMs} min={200} max={6000} onChange={v => updateSettings(s => ({ ...s, correctRevealMs: v }))} />
                  <LabeledSlider label="End delay" value={quiz.settings!.endDelayMs ?? 1000} min={0} max={5000} onChange={v => updateSettings(s => ({ ...s, endDelayMs: v }))} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <LabeledSlider label="Answer width %" value={quiz.settings!.answerWidthPercent ?? 50} min={20} max={100} onChange={v => updateSettings(s => ({ ...s, answerWidthPercent: v }))} />
                </div>
              </div>

              {/* Quiz Fonts */}
              <div className="bg-gray-100/20 rounded-lg p-3">
                <div className="text-sm font-medium text-gray-300 mb-3">🔤 Quiz Fonts</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <div className="text-sm text-iossub mb-1">Font Family</div>
                    <select
                      className="ios-input w-full"
                      value={quiz.settings?.fontFamily || 'Impact'}
                      onChange={e => updateSettings(s => ({ ...s, fontFamily: e.target.value }))}
                    >
                      <option value="Impact">Impact</option>
                      <option value="Arial Black">Arial Black</option>
                      <option value="Helvetica">Helvetica</option>
                      <option value="Comic Sans MS">Comic Sans MS</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Verdana">Verdana</option>
                      <option value="Trebuchet MS">Trebuchet MS</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <LabeledSlider label="Title size %" value={quiz.settings!.titleSizePercent ?? 6.0} min={2} max={12} step={0.1} onChange={v => updateSettings(s => ({ ...s, titleSizePercent: v }))} />
                  <LabeledSlider label="Question size %" value={quiz.settings!.questionSizePercent ?? 4.5} min={2} max={10} step={0.1} onChange={v => updateSettings(s => ({ ...s, questionSizePercent: v }))} />
                  <LabeledSlider label="Answer size %" value={quiz.settings!.answerSizePercent ?? 2.2} min={1} max={6} step={0.1} onChange={v => updateSettings(s => ({ ...s, answerSizePercent: v }))} />
            </div>
          </div>

              {/* Questions List */}
              <div className="bg-gray-100/20 rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-gray-300">Questions</div>
                  <div className="flex gap-2">
                    <button className="ios-card px-3 py-1" onClick={() => addQuestion(createBooleanQuestion('New True/False') as QuizQuestion)}>+ True/False</button>
                    <button className="ios-card px-3 py-1" onClick={() => addQuestion(createMultipleChoiceQuestion('New Multiple Choice') as QuizQuestion)}>+ Multiple</button>
                    {quiz.questions.length > 0 && (
                      <button
                        className="ios-card px-3 py-1 text-red-400 hover:text-red-200"
                        onClick={deleteAllQuestions}
                      >
                        🗑 Delete All
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {quiz.questions.map(q => {
                    const isSelected = selectedQuestionId === q.id
                    const isDropTarget = dragOverInfo?.targetId === q.id
                    const isDragging = draggedQuestionId === q.id
                    const dropPosition = dragOverInfo?.position

                    return (
                      <div
                        key={q.id}
                        className="relative"
                        onDragOver={event => handleQuestionDragOver(event, q.id)}
                        onDrop={event => handleQuestionDrop(event, q.id)}
                      >
                        {isDropTarget && dropPosition === 'before' && (
                          <div className="absolute -top-1 left-0 right-0 h-1 rounded-full bg-blue-400 pointer-events-none" />
                        )}
                        {isDropTarget && dropPosition === 'after' && (
                          <div className="absolute -bottom-1 left-0 right-0 h-1 rounded-full bg-blue-400 pointer-events-none" />
                        )}
                        <div
                          data-question-item
                          draggable
                          onDragStart={event => handleQuestionDragStart(event, q.id)}
                          onDragEnd={handleQuestionDragEnd}
                          onClick={() => setSelectedQuestionId(q.id)}
                          className={`p-3 rounded-xl border cursor-grab select-none ${
                            isDropTarget
                              ? 'border-blue-400 ring-2 ring-blue-400/30'
                              : isSelected
                                ? 'border-white/30'
                                : 'border-iosborder'
                          } ${isDragging ? 'opacity-60' : ''}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm">{q.title}</div>
                            <div className="flex items-center gap-2 text-xs text-iossub">
                              <span>{q.type}</span>
                              <button
                                className="text-red-400 hover:text-red-200"
                                onClick={e => {
                                  e.stopPropagation()
                                  removeQuestion(q.id)
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {draggedQuestionId && (
                    <div
                      className={`rounded-lg border-2 border-dashed px-3 py-2 text-center text-xs transition ${
                        dragOverInfo?.targetId === null
                          ? 'border-blue-400 text-blue-300 bg-blue-400/10'
                          : 'border-iosborder/70 text-iossub'
                      }`}
                      onDragOver={event => {
                        if (!draggedQuestionId) return
                        event.preventDefault()
                        setDragOverInfo({ targetId: null, position: 'after' })
                      }}
                      onDrop={handleQuestionListDropToEnd}
                    >
                      Drop here to move to the end
                    </div>
                  )}
                </div>
          </div>

              {/* Question Editor */}
          {selectedQuestion && (
                <div className="ios-card p-4">
                  <div className="text-sm font-medium text-gray-300 mb-3">Edit Question</div>
                  <TransparentTextarea 
                    className="ios-input w-full mb-3 min-h-[60px] resize-y" 
                    value={selectedQuestion.title} 
                    onChange={value => updateQuestion({ ...selectedQuestion, title: value })} 
                    placeholder="Enter your question&#10;Use Enter for line breaks"
                    rows={2}
                  />
              <div className="space-y-2">
                {selectedQuestion.answers.map((a: QuizAnswer) => (
                  <div key={a.id} className="flex items-center gap-2">
                        <TransparentTextarea 
                          className="ios-input flex-1 min-h-[40px] resize-y" 
                          value={a.text} 
                          onChange={value => handleAnswerTextChange(selectedQuestion, a.id, value)} 
                          placeholder="Answer text&#10;Use Enter for line breaks"
                          rows={1}
                        />
                    <label className="flex items-center gap-1 text-sm">
                      <input type="checkbox" checked={a.isCorrect} onChange={e => handleCorrectToggle(selectedQuestion, a.id, e.target.checked)} />
                      Correct
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
            </div>
          )}

          {/* Meme Tab */}
          {activeTab === 'meme' && (
            <div className="space-y-4">
              {/* Meme Text Input */}
              <div className="bg-gray-100/20 rounded-lg p-3">
                <div className="text-sm font-medium text-gray-300 mb-3">📝 Meme Text</div>
                <div className="space-y-3">
                  <div>
                    <label className="flex items-center gap-2 text-sm mb-2">
                      <input 
                        type="checkbox" 
                        checked={meme.settings?.showTopText ?? true} 
                        onChange={e => updateMemeSettings(s => ({ ...s, showTopText: e.target.checked }))} 
                      />
                      Show Top Text
                    </label>
                    {meme.settings?.showTopText && (
                      <TransparentTextarea 
                        className="ios-input w-full mb-2 min-h-[60px] resize-y" 
                        value={meme.topText || ''} 
                        onChange={updateTopText} 
                        placeholder="Enter top text for your meme&#10;Use Enter for line breaks" 
                        rows={2}
                      />
                    )}
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm mb-2">
                      <input 
                        type="checkbox" 
                        checked={meme.settings?.showBottomText ?? true} 
                        onChange={e => updateMemeSettings(s => ({ ...s, showBottomText: e.target.checked }))} 
                      />
                      Show Bottom Text
                    </label>
                    {meme.settings?.showBottomText && (
                      <TransparentTextarea 
                        className="ios-input w-full mb-2 min-h-[60px] resize-y" 
                        value={meme.bottomText || ''} 
                        onChange={updateBottomText} 
                        placeholder="Enter bottom text for your meme&#10;Use Enter for line breaks" 
                        rows={2}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Meme Settings */}
              <div className="bg-gray-100/20 rounded-lg p-3">
                <div className="text-sm font-medium text-gray-300 mb-3">⚙️ Meme Settings</div>
                <MemeSettingsPanel
                  settings={meme.settings || {
                    topTextColor: '#ffffff',
                    bottomTextColor: '#ffffff'
                  }}
                  onUpdate={updateMemeSettings}
                />
              </div>

              {/* AI Meme Generator */}
              <div className="bg-gray-100/20 rounded-lg p-3">
                <div className="text-sm font-medium text-gray-300 mb-3">🤖 AI Meme Generator</div>
                <button 
                  className="ios-card px-3 py-2 w-full" 
                  onClick={() => setShowMemeAIModal(true)}
                >
                  Generate Meme with AI
                </button>
              </div>

              {/* Save/Load JSON */}
              <div className="bg-gray-100/20 rounded-lg p-3">
                <div className="text-sm font-medium text-gray-300 mb-3">💾 Save/Load</div>
                <div className="space-y-2">
                  <button 
                    className="ios-card px-3 py-2 w-full" 
                    onClick={() => {
                      const json = memeToJsonString()
                      const blob = new Blob([json], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'meme.json'
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                  >
                    Save JSON
                  </button>
                  <label className="ios-card px-3 py-2 w-full cursor-pointer text-center block">
                    Load JSON
                    <input 
                      type="file" 
                      accept=".json" 
                      className="hidden" 
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = (event) => {
                          const content = event.target?.result as string
                          loadMemeFromJsonString(content)
                        }
                        reader.readAsText(file)
                      }} 
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Preview */}
        <div className="ios-card p-4 relative flex flex-col gap-4">
          <div className="relative mx-auto w-full" style={aspectStyle(quiz.settings?.aspectRatio ?? '9:16')}>
            <div data-frame className="absolute inset-0">
              {activeTab === 'meme' || quiz.settings?.animationType === 'meme' ? (
                <MemePreview 
                  meme={meme} 
                  quizSettings={quiz.settings!}
                  quizBackground={quiz.background}
                  isRecording={isRecording}
                  recordingTime={recordingProgress}
                />
              ) : (
                <>
                  <BackgroundRenderer 
                    background={quiz.background} 
                    zoom={quiz.settings!.bgZoomEnabled ? (quiz.settings!.bgZoomScale ?? 1.1) : 1} 
                    isPlaying={isPlaying} 
                    playKey={playVersion}
                    quiz={quiz}
                  />
                  <div 
                    className="absolute inset-0 pointer-events-none" 
                    style={{ 
                      background: quiz.settings?.overlayColor ?? 'transparent', 
                      opacity: quiz.settings?.overlayOpacity ?? 0 
                    }}
                  />
                </>
              )}
            </div>
            {activeTab !== 'meme' && quiz.settings?.animationType !== 'meme' && (
              <div ref={previewRef} id="preview-window" data-record-area className="absolute inset-0 p-6 overflow-hidden bg-transparent">
                {/* Background */}
                <BackgroundRenderer
                  background={quiz.background}
                  zoom={quiz.settings?.bgZoomEnabled ? (quiz.settings?.bgZoomScale ?? 1.1) : 1}
                  isPlaying={isPlaying}
                  playKey={playVersion}
                  quiz={quiz}
                />
                {isPlaying ? (
                  <SequencePreview 
                    key={playVersion} 
                    quiz={quiz} 
                    onFinished={() => setIsPlaying(false)} 
                    playSignal={playVersion}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-iossub"></div>
                )}
              </div>
            )}
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-start gap-2">
              {!isPlaying ? (
                <button className="ios-card px-3 py-2" onClick={() => { setIsPlaying(true); setPlayVersion(v => v + 1) }}>Preview animation</button>
              ) : (
                <button className="ios-card px-3 py-2" onClick={() => setIsPlaying(false)}>Stop preview</button>
              )}
            </div>
            
            {/* Recording */}
            <div className="ios-card p-3">
              <button 
                className={`ios-card px-3 py-2 w-full ${isRecording ? 'bg-red-500' : ''}`} 
                onClick={recordVideo}
                disabled={isRecording}
              >
                {isRecording ? `Recording... ${recordingProgress.toFixed(0)}%` : '🎬 Record Video'}
              </button>
               </div>
               
            {/* Recording Settings */}
               <div className="ios-card p-3">
              <div className="text-sm text-iossub mb-3">Recording Settings</div>
                 <div className="grid grid-cols-2 gap-3 mb-3">
                   <div>
                     <label className="block text-sm text-iossub mb-1">Aspect Ratio</label>
                     <select
                       className="ios-input w-full"
                       value={quiz.settings?.aspectRatio}
                       onChange={e => updateSettings(s => ({ ...s, aspectRatio: e.target.value as AspectRatio }))}
                     >
                       <option value="1:1">1:1 Square</option>
                       <option value="3:4">3:4 Portrait</option>
                       <option value="9:16">9:16 Portrait</option>
                     </select>
                   </div>
                   <div>
                     <label className="block text-sm text-iossub mb-1">Quality</label>
                     <select 
                       className="ios-input w-full" 
                    value={videoQuality} 
                    onChange={(e) => setVideoQuality(e.target.value as 'low' | 'medium' | 'high' | 'ultra')}
                  >
                    <option value="low">Low (1Mbps, CRF 28)</option>
                    <option value="medium">Medium (3Mbps, CRF 23)</option>
                    <option value="high">High (8Mbps, CRF 20)</option>
                    <option value="ultra">Ultra (15Mbps, CRF 18)</option>
                     </select>
                   </div>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                   <div>
                     <label className="block text-sm text-iossub mb-1">Format</label>
                     <select 
                       className="ios-input w-full" 
                    value={exportFormat} 
                    onChange={(e) => setExportFormat(e.target.value as 'webm' | 'mp4')}
                  >
                    <option value="webm">WebM (VP9)</option>
                    <option value="mp4">MP4 (H.264)</option>
                     </select>
                   </div>
                   <div>
                     <label className="block text-sm text-iossub mb-1">Resolution</label>
                     <div className="text-xs text-gray-400">
                       {quiz.settings?.aspectRatio === '1:1' && '1080×1080'}
                       {quiz.settings?.aspectRatio === '3:4' && '1080×1440'}
                       {quiz.settings?.aspectRatio === '9:16' && '1080×1920'}
                     </div>
                   </div>
                 </div>
                 </div>
                 
            {/* Recording Status */}
            {recordingStatus && (
              <div className="ios-card p-3">
                <div className="text-sm text-iossub">{recordingStatus}</div>
                {isRecording && (
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${recordingProgress}%` }}
                    ></div>
                   </div>
                )}
                     </div>
                   )}
                 </div>
               </div>
            </div>

      {/* Modals */}
      <AIModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        customInstructions={customInstructions}
        onCustomInstructionsChange={persistCustomInstructions}
        openaiApiKey={openaiApiKey}
        onOpenaiApiKeyChange={persistOpenaiApiKey}
      />

      <StockMediaModal
        isOpen={showStockMedia}
        onClose={() => setShowStockMedia(false)}
        onSelectImage={handleStockImageSelect}
        onSelectVideo={handleStockVideoSelect}
        type={stockMediaType}
      />

      <StockMediaModal
        isOpen={showSplitScreenStockMedia}
        onClose={() => setShowSplitScreenStockMedia(false)}
        onSelectImage={handleStockImageSelect} // Not used for split screen, but required by interface
        onSelectVideo={handleSplitScreenStockVideoSelect}
        type={splitScreenStockMediaType}
      />

      <PixabayMusicModal
        isOpen={showPixabayMusic}
        onClose={() => setShowPixabayMusic(false)}
        onSelectMusic={handlePixabayMusicSelect}
      />

      <TikTokMusicModal
        isOpen={showTikTokMusic}
        onClose={() => setShowTikTokMusic(false)}
        onSelectMusic={handleTikTokMusicSelect}
      />

      <FreesoundMusicModal
        isOpen={showFreesoundMusic}
        onClose={() => setShowFreesoundMusic(false)}
        onSelectMusic={handleFreesoundMusicSelect}
      />

      <LocalMusicModal
        isOpen={showLocalMusic}
        onClose={() => setShowLocalMusic(false)}
        onSelectMusic={handleLocalMusicSelect}
      />

      <YouTubeAudioModal
        isOpen={showYouTubeAudio}
        onClose={() => setShowYouTubeAudio(false)}
        onSelectMusic={handleYouTubeAudioSelect}
      />

      <RealMusicModal
        isOpen={showRealMusic}
        onClose={() => setShowRealMusic(false)}
        onSelectMusic={handleRealMusicSelect}
      />

      <MemeAIModal
        isOpen={showMemeAIModal}
        onClose={() => setShowMemeAIModal(false)}
        onGenerateMeme={(topText, bottomText) => {
          updateTopText(topText)
          updateBottomText(bottomText)
        }}
        apiKey={openaiApiKey}
        onApiKeyChange={persistOpenaiApiKey}
      />

    </div>
  )
}

// Helper functions
function aspectStyle(ar: AspectRatio) {
  const map: Record<AspectRatio, string> = { '1:1': '1 / 1', '3:4': '3 / 4', '9:16': '9 / 16' }
  const ratio = map[ar]
  return { aspectRatio: ratio as any, width: '100%', maxWidth: '800px', maxHeight: '70vh' }
}

function computeExactDuration(quiz: QuizData): number {
  const settings = quiz.settings!
  
  // Handle meme animation type
  if (settings.animationType === 'meme') {
    const meme = (quiz as any).meme || { settings: {} }
    const memeSettings = meme.settings || {}
    
    const topTextInMs = memeSettings.topTextInMs || 500
    const bottomTextInMs = memeSettings.bottomTextInMs || 500
    const topTextHoldMs = memeSettings.topTextHoldMs || 3000
    const bottomTextHoldMs = memeSettings.bottomTextHoldMs || 3000
    const topTextFadeOutMs = memeSettings.topTextFadeOutMs || 500
    const bottomTextFadeOutMs = memeSettings.bottomTextFadeOutMs || 500
    
    // Calculate when each text should fade out
    const topTextFadeOutStartTime = topTextInMs + topTextHoldMs
    const bottomTextFadeOutStartTime = topTextInMs + bottomTextInMs + bottomTextHoldMs
    
    // Calculate total meme duration (when both texts are completely gone)
    const contentDuration = Math.max(
      topTextFadeOutStartTime + topTextFadeOutMs,
      bottomTextFadeOutStartTime + bottomTextFadeOutMs
    )
    
    const ctaDuration = settings.cta?.enabled ? (settings.cta.durationMs ?? 3000) : 0
    const totalDuration = contentDuration + ctaDuration
    return totalDuration
  }
  
  const timeline = computeQuizTimeline(quiz)
  const totalDuration = timeline.totalContentDuration + timeline.ctaDuration + timeline.endDelay
  return totalDuration
}
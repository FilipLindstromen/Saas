import { useState, useEffect, useRef } from 'react'
import TemplateSelector from './TemplateSelector'
import './PlanMode.css'

// Section tips by template key; section name -> { about, performWell }
const SECTION_TIPS = {
  pas: {
    'Problem': { about: 'Clearly define the pain point or challenge your audience faces. Use concrete examples and make it relatable so they nod along.', performWell: 'use one vivid example or stat that makes the problem feel urgent and personal.' },
    'Agitate': { about: 'Deepen the problem: show consequences, missed opportunities, or how it gets worse if left unaddressed. Emotion here creates readiness for the solution.', performWell: 'add a short story or scenario that shows the cost of inaction.' },
    'Solution': { about: 'Introduce your product, idea, or approach as the clear answer. Keep it simple and directly tied to the problem you just agitated.', performWell: 'state the one key benefit first, then support it with proof.' }
  },
  aida: {
    'Attention': { about: 'Open with a hook: a surprising fact, question, or story that stops the audience from thinking about anything else.', performWell: 'lead with a single bold claim or question that demands a response.' },
    'Interest': { about: 'Build curiosity by showing why this matters to them. Share relevant insights, trends, or implications that keep them engaged.', performWell: 'connect the hook to their world with one or two concrete details.' },
    'Desire': { about: 'Create want: show the outcome, the transformation, or the benefit they’ll get. Make the future state tangible and desirable.', performWell: 'paint one clear “after” picture so they can see themselves in it.' },
    'Action': { about: 'Tell them exactly what to do next. One clear call to action, with minimal friction, so they can act immediately.', performWell: 'give one primary CTA and one simple first step.' }
  },
  story: {
    'The Scene': { about: 'Set the world and the main character (often the audience or a relatable proxy). Establish normalcy before the disruption.', performWell: 'use one specific detail that makes the scene feel real.' },
    'The Problem': { about: 'Introduce the challenge or obstacle. The character wants something or must deal with something that’s in the way.', performWell: 'state the problem in one sentence the audience can repeat.' },
    'Failed Attempts': { about: 'Show that the obvious fixes don’t work. This builds tension and makes the audience root for a real solution.', performWell: 'show one failed attempt that everyone can relate to.' },
    'The Crisis': { about: 'Escalate to the lowest or most critical point. Stakes should feel as high as they can get.', performWell: 'one moment or line that makes the crisis feel unavoidable.' },
    'The Insight': { about: 'The “aha” moment: a new way of seeing the situation or a key realization that unlocks the path forward.', performWell: 'phrase the insight as a single memorable line.' },
    'The Solution': { about: 'The character takes action on the insight and things turn around. Show the solution working.', performWell: 'tie the solution directly to the insight in one clear beat.' },
    'The New Life': { about: 'Describe the new normal after the change. The audience should see the reward of the journey.', performWell: 'contrast one “before” and “after” detail.' },
    'The Lesson': { about: 'Spell out the takeaway for the audience. Make it explicit so they can apply it to their own situation.', performWell: 'end with one actionable lesson they can use today.' }
  },
  bab: {
    'Before': { about: 'Describe the current state: where they are today, what’s not working, or what they’re missing. Be specific and relatable.', performWell: 'use one concrete before-state that your audience will recognise.' },
    'After': { about: 'Paint the desired future: the outcome, the feeling, or the results they want. Make it vivid and achievable.', performWell: 'describe the after in one sentence that feels worth the effort.' },
    'Bridge': { about: 'Show how to get from before to after. Your solution, steps, or method is the bridge—keep it clear and actionable.', performWell: 'name the one main step or change that makes the bridge work.' }
  },
  hookStoryAsk: {
    'The Hook': { about: 'Grab attention in the first few seconds with a question, stat, or statement that demands a reaction.', performWell: 'open with one line that makes them lean in.' },
    'The Story': { about: 'Tell a short, relevant story that illustrates the point and builds emotional connection. Keep it focused.', performWell: 'include one moment of tension or surprise in the story.' },
    'The Ask': { about: 'Make your call to action explicit. What should they do, think, or feel when they leave?', performWell: 'give one clear, specific ask with a deadline or next step.' }
  },
  whatSoWhatNowWhat: {
    'What': { about: 'Explain what it is: the topic, product, or situation. Stick to facts and clarity so everyone is on the same page.', performWell: 'define “what” in one sentence anyone can repeat.' },
    'So What': { about: 'Explain why it matters: implications, stakes, or relevance to the audience. Connect the “what” to their world.', performWell: 'give one reason they should care, stated plainly.' },
    'Now What': { about: 'Spell out what happens next: actions, decisions, or next steps. Be concrete so they know what to do.', performWell: 'list one to three clear next steps, with one primary action.' }
  },
  featuresBenefitsProof: {
    'Features': { about: 'Present the main features or capabilities. Keep it factual and easy to scan.', performWell: 'lead with the one feature that differentiates you most.' },
    'Benefits': { about: 'Translate features into outcomes: what the audience gains, feels, or achieves. Benefits answer “so what?”', performWell: 'tie each benefit to one concrete outcome they care about.' },
    'Proof': { about: 'Back it up with evidence: data, testimonials, case studies, or demos. Proof turns belief into confidence.', performWell: 'use one strong proof point (number, quote, or example) per claim.' }
  },
  problemSolutionBenefits: {
    'Problem': { about: 'Define the problem clearly and relatably. Make sure the audience sees themselves in it.', performWell: 'use one example or stat that makes the problem undeniable.' },
    'Solution': { about: 'Present your solution as the direct answer to that problem. Keep the link between problem and solution obvious.', performWell: 'state how your solution fixes the problem in one sentence.' },
    'Benefits': { about: 'Highlight the key benefits: what they gain, save, or avoid. Make the value tangible.', performWell: 'focus on the top one to three benefits that matter most to this audience.' }
  },
  heroJourney: {
    'Ordinary World': { about: 'Show the hero (or audience) in their everyday context. Establish what “normal” looks like before the journey.', performWell: 'include one detail that makes the ordinary world feel familiar.' },
    'Call to Adventure': { about: 'Introduce the challenge, opportunity, or inciting incident that disrupts the status quo.', performWell: 'make the call to adventure one clear moment or decision.' },
    'Refusal of the Call': { about: 'Show hesitation or resistance. This makes the journey feel real and raises stakes.', performWell: 'name one specific fear or reason for refusal.' },
    'Crossing the Threshold': { about: 'The commitment point: the hero steps into the new world and the journey truly begins.', performWell: 'show one concrete step that marks the crossing.' },
    'Tests and Allies': { about: 'Obstacles and helpers along the way. Show progress, setbacks, and who (or what) helps.', performWell: 'highlight one test and one ally that matter most.' },
    'Approach to the Inmost Cave': { about: 'Build toward the central challenge. Tension and preparation for the biggest obstacle.', performWell: 'create one moment of anticipation before the ordeal.' },
    'Ordeal': { about: 'The major crisis or confrontation. The hero faces the core challenge and is tested to the limit.', performWell: 'make the ordeal one decisive moment or choice.' },
    'Reward': { about: 'What the hero gains from surviving the ordeal: insight, tool, relationship, or clarity.', performWell: 'state the reward in one clear, tangible form.' },
    'Return': { about: 'Bring the hero back to the ordinary world, changed. Show the return and reintegration.', performWell: 'show one way the ordinary world is different because of the journey.' }
  },
  learnPracticeApply: {
    'Module Overview': { about: 'Set expectations: what they’ll learn, why it matters, and how the module is structured.', performWell: 'give one sentence that states the module’s main outcome.' },
    'Learn': { about: 'Teach the core concepts and theory. Build understanding before practice.', performWell: 'anchor the section with one key concept or principle.' },
    'Practice': { about: 'Guided exercises or activities so they can try the skill in a safe context.', performWell: 'include one practice task they can do in under five minutes.' },
    'Apply': { about: 'Connect to real use: how they’ll use this in the real world or in a project.', performWell: 'give one concrete “apply this by…” instruction.' }
  },
  foundationBuildingMastery: {
    'Module Introduction': { about: 'Introduce the module’s goal and how Foundation → Building → Mastery will take them there.', performWell: 'state the end-state skill or outcome in one sentence.' },
    'Foundation': { about: 'Cover the essentials: the basics everyone needs before going deeper.', performWell: 'emphasise the one foundational idea they must not skip.' },
    'Building': { about: 'Add intermediate skills and connections between concepts. They’re building on the foundation.', performWell: 'show one clear link between foundation and this level.' },
    'Mastery': { about: 'Advanced techniques and confidence. They can perform at a high level and adapt.', performWell: 'define one “mastery” behaviour or outcome they can aim for.' }
  },
  problemSolutionImplementation: {
    'Module Overview': { about: 'Frame the module around the problem you’ll solve and what they’ll be able to do by the end.', performWell: 'state the problem and the end-state in one sentence each.' },
    'The Problem': { about: 'Spell out the specific challenge: what’s broken, missing, or difficult today.', performWell: 'use one example that makes the problem concrete.' },
    'The Solution': { about: 'Present the approach, method, or solution that addresses the problem.', performWell: 'summarise the solution in one clear sentence.' },
    'Implementation': { about: 'Step-by-step how to put the solution into practice. Make it doable and clear.', performWell: 'give one first step they can do immediately after the module.' }
  }
}

function PlanMode({ slides, onUpdateSlides, onLoadTemplate, showTemplates = false, setShowTemplates, settings, chapters = [], currentChapterId, onUpdateChapterSlides, onReorderChapters, onUpdateChapterName, projectName = '', onProjectNameChange }) {
  const [planView, setPlanView] = useState('standard') // 'standard' | 'overview'
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [draggedId, setDraggedId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const [draggedChapterId, setDraggedChapterId] = useState(null)
  const [dragOverChapterId, setDragOverChapterId] = useState(null)
  const [editingChapterId, setEditingChapterId] = useState(null)
  const [editingChapterName, setEditingChapterName] = useState('')
  const chapterNameInputRef = useRef(null)
  const [editingPlanTitle, setEditingPlanTitle] = useState(false)
  const planTitleInputRef = useRef(null)
  const planTitleBeforeEditRef = useRef('')
  const [generateInput, setGenerateInput] = useState(() => {
    // Load from localStorage on mount
    return localStorage.getItem('pitchDeckGenerateInput') || ''
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(() => {
    // Load from localStorage on mount
    const saved = localStorage.getItem('pitchDeckSelectedTemplate')
    return saved ? JSON.parse(saved) : null
  })
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(() => {
    const saved = localStorage.getItem('pitchDeckSelectedTemplateKey')
    return saved || null
  })
  const [showSlideTips, setShowSlideTips] = useState(() => {
    return localStorage.getItem('pitchDeckShowSlideTips') === 'true'
  })
  const [isRecording, setIsRecording] = useState(false)
  const [availableMicrophones, setAvailableMicrophones] = useState([])
  const [selectedMicrophone, setSelectedMicrophone] = useState(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [showGenerate, setShowGenerate] = useState(false)
  const [slideCount, setSlideCount] = useState(() => localStorage.getItem('pitchDeckSlideCount') || '')
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const streamRef = useRef(null)
  const textareaRef = useRef(null)
  const lastEnterTimeRef = useRef(0)

  const isOverview = planView === 'overview' && chapters?.length && onUpdateChapterSlides
  const currentChapter = (chapters || []).find(c => c.id === currentChapterId) || (chapters || [])[0]
  const getChapterForSlide = (slideId) => (chapters || []).find(c => c.slides.some(s => s.id === slideId))
  const getSlidesForContext = (slideIdOrChapterId) => {
    if (!isOverview) return slides
    if (typeof slideIdOrChapterId === 'number' && chapters.some(c => c.id === slideIdOrChapterId)) {
      const ch = chapters.find(c => c.id === slideIdOrChapterId)
      return ch ? ch.slides : slides
    }
    const ch = getChapterForSlide(slideIdOrChapterId)
    return ch ? ch.slides : slides
  }
  const applyUpdate = (slideIdOrChapterId, newSlides) => {
    if (!isOverview) {
      onUpdateSlides(newSlides)
      return
    }
    let chapterId
    if (typeof slideIdOrChapterId === 'number' && chapters.some(c => c.id === slideIdOrChapterId)) {
      chapterId = slideIdOrChapterId
    } else {
      const ch = getChapterForSlide(slideIdOrChapterId)
      chapterId = ch?.id
    }
    if (chapterId != null) onUpdateChapterSlides(chapterId, newSlides)
  }
  const maxSlideId = () => {
    if (isOverview && chapters?.length) return Math.max(0, ...chapters.flatMap(c => c.slides.map(s => s.id)))
    return Math.max(0, ...(slides || []).map(s => s.id))
  }

  // Save generateInput to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('pitchDeckGenerateInput', generateInput)
  }, [generateInput])

  // Save selectedTemplate to localStorage whenever it changes
  useEffect(() => {
    if (selectedTemplate) {
      localStorage.setItem('pitchDeckSelectedTemplate', JSON.stringify(selectedTemplate))
    }
  }, [selectedTemplate])

  // Save slideCount to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('pitchDeckSlideCount', slideCount)
  }, [slideCount])

  useEffect(() => {
    if (selectedTemplateKey) localStorage.setItem('pitchDeckSelectedTemplateKey', selectedTemplateKey)
  }, [selectedTemplateKey])

  useEffect(() => {
    localStorage.setItem('pitchDeckShowSlideTips', String(showSlideTips))
  }, [showSlideTips])

  // Load available microphones on mount
  useEffect(() => {
    loadMicrophones()
    
    // Listen for device changes (e.g., when user plugs in a new microphone)
    const handleDeviceChange = () => {
      loadMicrophones()
    }
    
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
    
    // Cleanup: remove event listener on unmount
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
    }
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const loadMicrophones = async () => {
    try {
      // First, request permission to access media devices
      // This is required for browsers to show proper device labels
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        // Stop the temporary stream immediately
        tempStream.getTracks().forEach(track => track.stop())
      } catch (permError) {
        console.warn('Permission not granted for microphone access:', permError)
        // Continue anyway - devices might still be enumerable
      }

      // Now enumerate devices with proper labels
      const devices = await navigator.mediaDevices.enumerateDevices()
      const microphones = devices.filter(device => device.kind === 'audioinput')
      
      // Filter out duplicate device IDs and ensure we have valid labels
      const uniqueMicrophones = []
      const seenIds = new Set()
      
      for (const mic of microphones) {
        if (!seenIds.has(mic.deviceId)) {
          seenIds.add(mic.deviceId)
          // If label is empty, provide a default name
          if (!mic.label || mic.label.trim() === '') {
            uniqueMicrophones.push({
              ...mic,
              label: `Microphone ${uniqueMicrophones.length + 1}`
            })
          } else {
            uniqueMicrophones.push(mic)
          }
        }
      }
      
      setAvailableMicrophones(uniqueMicrophones)
      
      // Set default microphone if none selected
      if (!selectedMicrophone && uniqueMicrophones.length > 0) {
        setSelectedMicrophone(uniqueMicrophones[0].deviceId)
      }
    } catch (error) {
      console.error('Error loading microphones:', error)
      alert(`Error loading microphones: ${error.message}`)
    }
  }

  const handleStartRecording = async () => {
    if (!settings?.openaiKey) {
      alert('Please set your OpenAI API key in settings first.')
      return
    }

    try {
      // Build audio constraints with device selection
      const audioConstraints = selectedMicrophone 
        ? { 
            deviceId: { exact: selectedMicrophone },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        : {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
      
      const constraints = {
        audio: audioConstraints
      }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      
      // Verify we got the right device
      const audioTracks = stream.getAudioTracks()
      if (audioTracks.length > 0 && selectedMicrophone) {
        const actualDeviceId = audioTracks[0].getSettings().deviceId
        if (actualDeviceId !== selectedMicrophone) {
          console.warn('Device mismatch. Requested:', selectedMicrophone, 'Got:', actualDeviceId)
        }
      }
      
      // Find supported mime type
      const supportedTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/mpeg'
      ]
      
      let mimeType = 'audio/webm'
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type
          break
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType
      })
      
      audioChunksRef.current = []
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = async () => {
        await handleTranscribe()
      }
      
      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Error starting recording:', error)
      alert(`Error starting recording: ${error.message}`)
    }
  }

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      
      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
  }

  const handleTranscribe = async () => {
    if (audioChunksRef.current.length === 0) {
      return
    }

    setIsTranscribing(true)

    try {
      // Determine file extension and mime type based on recorded format
      const firstChunk = audioChunksRef.current[0]
      const blobType = firstChunk.type || 'audio/webm'
      let fileName = 'recording.webm'
      let fileType = 'audio/webm'
      
      if (blobType.includes('mp4') || blobType.includes('mpeg')) {
        fileName = 'recording.mp4'
        fileType = 'audio/mp4'
      } else if (blobType.includes('ogg')) {
        fileName = 'recording.ogg'
        fileType = 'audio/ogg'
      }
      
      // Create a blob from audio chunks
      const audioBlob = new Blob(audioChunksRef.current, { type: blobType })
      
      // Convert to File for OpenAI API
      const audioFile = new File([audioBlob], fileName, { type: fileType })
      
      // Create FormData for OpenAI Whisper API
      const formData = new FormData()
      formData.append('file', audioFile)
      formData.append('model', 'whisper-1')
      
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.openaiKey}`
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`)
      }

      const data = await response.json()
      const transcribedText = data.text || ''
      
      // Append transcribed text to existing input (or replace if empty)
      if (transcribedText) {
        setGenerateInput(prev => prev ? `${prev} ${transcribedText}` : transcribedText)
      }
    } catch (error) {
      console.error('Error transcribing audio:', error)
      alert(`Error transcribing audio: ${error.message}`)
    } finally {
      setIsTranscribing(false)
      audioChunksRef.current = []
    }
  }

  // Focus textarea when editing starts and auto-resize
  useEffect(() => {
    if (editingId !== null && textareaRef.current) {
      // Auto-resize to fit content
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
      textareaRef.current.focus()
      // Don't select all, just place cursor at end
      const length = textareaRef.current.value.length
      textareaRef.current.setSelectionRange(length, length)
    }
  }, [editingId])

  const handleAddScene = (chapterId) => {
    if (editingId !== null) {
      const contextKey = editingContextKey()
      const editSlides = getSlidesForContext(contextKey)
      const updatedSlides = editSlides.map(slide =>
        slide.id === editingId ? { ...slide, content: editContent } : slide
      )
      applyUpdate(contextKey, updatedSlides)
    }
    const newId = maxSlideId() + 1
    const newSlide = {
      id: newId,
      content: '',
      subtitle: '',
      imageUrl: '',
      layout: 'default',
      gradientStrength: 0.7,
      flipHorizontal: false,
      backgroundOpacity: 0.6,
      gradientFlipped: false,
      imageScale: 1.0,
      imagePositionX: 50,
      imagePositionY: 50,
      textHeadingLevel: null,
      subtitleHeadingLevel: null,
    }
    if (isOverview && chapterId != null) {
      const targetSlides = getSlidesForContext(chapterId)
      applyUpdate(chapterId, [...targetSlides, newSlide])
    } else {
      onUpdateSlides([...slides, newSlide])
    }
    setEditingId(newId)
    setEditContent('')
  }

  const handleAddSection = (chapterId) => {
    if (editingId !== null) {
      const contextKey = editingContextKey()
      const editSlides = getSlidesForContext(contextKey)
      const updatedSlides = editSlides.map(slide =>
        slide.id === editingId ? { ...slide, content: editContent } : slide
      )
      applyUpdate(contextKey, updatedSlides)
    }
    const newId = maxSlideId() + 1
    const newSection = {
      id: newId,
      content: 'Section Name',
      subtitle: '',
      imageUrl: '',
      layout: 'section',
      gradientStrength: 0.7,
      flipHorizontal: false,
      backgroundOpacity: 0.6,
      gradientFlipped: false,
      imageScale: 1.0,
      imagePositionX: 50,
      imagePositionY: 50,
      textHeadingLevel: null,
      subtitleHeadingLevel: null
    }
    if (isOverview && chapterId != null) {
      const targetSlides = getSlidesForContext(chapterId)
      applyUpdate(chapterId, [...targetSlides, newSection])
    } else {
      onUpdateSlides([...slides, newSection])
    }
    setEditingId(newId)
    setEditContent('Section Name')
  }

  const handleSceneClick = (slide, chapterId) => {
    if (isOverview && chapterId != null) {
      setEditingChapterId(chapterId)
    } else {
      setEditingChapterId(null)
    }
    setEditingId(slide.id)
    // Remove HTML tags for editing
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = slide.content || ''
    setEditContent(tempDiv.textContent || tempDiv.innerText || '')
  }

  const handleChange = (e) => {
    const newContent = e.target.value
    setEditContent(newContent)
    
    // Auto-resize textarea to fit content
    e.target.style.height = 'auto'
    e.target.style.height = e.target.scrollHeight + 'px'
    
    // Auto-save on every change
    if (editingId !== null) {
      const contextKey = editingContextKey()
      const contextSlides = getSlidesForContext(contextKey)
      const updatedSlides = contextSlides.map(slide =>
        slide.id === editingId ? { ...slide, content: newContent } : slide
      )
      applyUpdate(contextKey, updatedSlides)
    }
  }

  const handleBlur = () => {
    if (editingId !== null) {
      const contextKey = editingContextKey()
      const contextSlides = getSlidesForContext(contextKey)
      const updatedSlides = contextSlides.map(slide =>
        slide.id === editingId ? { ...slide, content: editContent } : slide
      )
      applyUpdate(contextKey, updatedSlides)
      setEditingId(null)
      setEditContent('')
    }
  }

  const handleKeyDown = (e, slideId) => {
    if (e.key === 'Enter') {
      const now = Date.now()
      const timeSinceLastEnter = now - lastEnterTimeRef.current
      
      // Check if cursor is at the end and content ends with newline (double Enter)
      const textarea = textareaRef.current
      const cursorPos = textarea.selectionStart
      const textBeforeCursor = editContent.substring(0, cursorPos)
      const textAfterCursor = editContent.substring(cursorPos)
      
      // Check if we're at the end of content and last character is newline
      const isAtEnd = cursorPos === editContent.length
      const endsWithNewline = textBeforeCursor.endsWith('\n')
      
      // Double Enter: if Enter pressed twice quickly OR if content ends with newline and we're at the end
      if ((timeSinceLastEnter < 500 && endsWithNewline) || (isAtEnd && endsWithNewline && textAfterCursor === '')) {
        e.preventDefault()
        const contextKey = editingContextKey()
        const contextSlides = getSlidesForContext(contextKey)
        const contentForCurrentSlide = textBeforeCursor.slice(0, -1)
        const contentForNewSlide = textAfterCursor.trim()
        const updatedSlides = contextSlides.map(slide =>
          slide.id === editingId ? { ...slide, content: contentForCurrentSlide } : slide
        )
        const newId = maxSlideId() + 1
        const newSlide = {
          id: newId,
          content: contentForNewSlide,
          subtitle: '',
          imageUrl: '',
          layout: 'default',
          gradientStrength: 0.7,
          flipHorizontal: false,
          backgroundOpacity: 0.6,
          gradientFlipped: false,
          imageScale: 1.0,
          imagePositionX: 50,
          imagePositionY: 50,
          textHeadingLevel: null,
          subtitleHeadingLevel: null
        }
        const currentIndex = updatedSlides.findIndex(s => s.id === editingId)
        const insertIndex = currentIndex >= 0 ? currentIndex + 1 : updatedSlides.length
        const finalSlides = [
          ...updatedSlides.slice(0, insertIndex),
          newSlide,
          ...updatedSlides.slice(insertIndex)
        ]
        applyUpdate(contextKey, finalSlides)
        setEditingId(newId)
        setEditContent(contentForNewSlide)
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus()
            const length = contentForNewSlide.length
            textareaRef.current.setSelectionRange(length, length)
          }
        }, 0)
      } else {
        lastEnterTimeRef.current = now
      }
    } else if (e.key === 'Escape') {
      if (editingId !== null) {
        const contextKey = editingContextKey()
        const contextSlides = getSlidesForContext(contextKey)
        const updatedSlides = contextSlides.map(slide =>
          slide.id === editingId ? { ...slide, content: editContent } : slide
        )
        applyUpdate(contextKey, updatedSlides)
      }
      setEditingId(null)
      setEditContent('')
    }
  }

  const handleDelete = (slideId, e, chapterId) => {
    e.stopPropagation()
    const contextKey = (isOverview && chapterId != null) ? chapterId : slideId
    const contextSlides = getSlidesForContext(contextKey)
    if (contextSlides.length > 1) {
      applyUpdate(contextKey, contextSlides.filter(s => s.id !== slideId))
    }
  }

  const handleDragStart = (e, slideId, chapterId) => {
    if (editingId === slideId) {
      e.preventDefault()
      return
    }
    if (isOverview && chapterId != null) {
      setDraggedChapterId(chapterId)
    }
    setDraggedId(slideId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', slideId)
  }

  const handleDragOver = (e, slideId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (slideId !== draggedId) {
      setDragOverId(slideId)
    }
  }

  const handleDragLeave = () => {
    setDragOverId(null)
  }

  const handleDrop = (e, targetSlideId, chapterId) => {
    e.preventDefault()
    setDragOverId(null)
    
    if (!draggedId || draggedId === targetSlideId) {
      setDraggedId(null)
      return
    }

    if (editingId !== null) {
      const contextKey = editingContextKey()
      const contextSlides = getSlidesForContext(contextKey)
      const savedSlides = contextSlides.map(slide =>
        slide.id === editingId ? { ...slide, content: editContent } : slide
      )
      applyUpdate(contextKey, savedSlides)
      setEditingId(null)
      setEditContent('')
    }

    const dragContextKey = (isOverview && draggedChapterId != null) ? draggedChapterId : draggedId
    const contextSlides = getSlidesForContext(dragContextKey)
    const draggedIndex = contextSlides.findIndex(s => s.id === draggedId)
    const targetIndex = contextSlides.findIndex(s => s.id === targetSlideId)
    
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedId(null)
      return
    }

    const newSlides = [...contextSlides]
    const [draggedSlide] = newSlides.splice(draggedIndex, 1)
    newSlides.splice(targetIndex, 0, draggedSlide)
    
    applyUpdate(dragContextKey, newSlides)
    setDraggedId(null)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDraggedChapterId(null)
    setDragOverId(null)
  }

  const handleChapterDragStart = (e, chapterId) => {
    setDraggedChapterId(chapterId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(chapterId))
    e.dataTransfer.setData('application/x-chapter-id', String(chapterId))
  }

  const handleChapterDragOver = (e, chapterId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (chapterId !== draggedChapterId) {
      setDragOverChapterId(chapterId)
    }
  }

  const handleChapterDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverChapterId(null)
    }
  }

  const handleChapterDrop = (e, targetChapterId) => {
    e.preventDefault()
    setDragOverChapterId(null)
    const sourceChapterId = draggedChapterId
    setDraggedChapterId(null)
    if (!sourceChapterId || sourceChapterId === targetChapterId || !onReorderChapters || !chapters?.length) return
    const fromIndex = chapters.findIndex(c => c.id === sourceChapterId)
    const toIndex = chapters.findIndex(c => c.id === targetChapterId)
    if (fromIndex === -1 || toIndex === -1) return
    const newOrder = [...chapters]
    const [removed] = newOrder.splice(fromIndex, 1)
    newOrder.splice(toIndex, 0, removed)
    onReorderChapters(newOrder)
  }

  const handleChapterDragEnd = () => {
    setDraggedChapterId(null)
    setDragOverChapterId(null)
  }

  useEffect(() => {
    if (editingChapterId !== null && chapterNameInputRef.current) {
      chapterNameInputRef.current.focus()
      chapterNameInputRef.current.select()
    }
  }, [editingChapterId])

  useEffect(() => {
    if (editingPlanTitle && planTitleInputRef.current) {
      planTitleInputRef.current.focus()
      planTitleInputRef.current.select()
    }
  }, [editingPlanTitle])

  const startEditingPlanTitle = () => {
    if (!onProjectNameChange) return
    planTitleBeforeEditRef.current = projectName || ''
    setEditingPlanTitle(true)
  }

  const savePlanTitle = () => {
    if (onProjectNameChange) {
      const trimmed = (projectName || '').trim()
      onProjectNameChange(trimmed !== '' ? trimmed : planTitleBeforeEditRef.current)
    }
    setEditingPlanTitle(false)
  }

  const handlePlanTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      savePlanTitle()
    } else if (e.key === 'Escape') {
      if (onProjectNameChange) onProjectNameChange(planTitleBeforeEditRef.current)
      setEditingPlanTitle(false)
      planTitleInputRef.current?.blur()
    }
  }

  const startEditingChapterName = (chapter) => {
    setEditingChapterId(chapter.id)
    setEditingChapterName(chapter.name || '')
  }

  const saveChapterName = () => {
    if (editingChapterId === null) return
    const trimmed = editingChapterName.trim()
    if (onUpdateChapterName && trimmed !== '') {
      onUpdateChapterName(editingChapterId, trimmed)
    }
    setEditingChapterId(null)
    setEditingChapterName('')
  }

  const cancelEditingChapterName = () => {
    setEditingChapterId(null)
    setEditingChapterName('')
  }

  const handleChapterNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveChapterName()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEditingChapterName()
    }
  }

  const handleGenerateSlides = async () => {
    if (!settings?.openaiKey || !generateInput.trim()) {
      alert('Please enter content and ensure OpenAI API key is set in settings.')
      return
    }

    // Get current sections (keep them)
    const sections = slides.filter(slide => slide.layout === 'section')
    
    if (sections.length === 0) {
      alert('No sections found. Please load a template first.')
      return
    }

    setIsGenerating(true)

    try {
      // Build prompt for OpenAI
      const sectionsList = sections.map(s => s.content).join(', ')
      const slideCountRule = slideCount
        ? `5. The total number of slides (excluding section headers) should be approximately ${slideCount}. Distribute them across the sections accordingly.`
        : ''
      const prompt = `You are creating a presentation based on the following template structure with these sections: ${sectionsList}

User input: ${generateInput}

Generate slide content for each section. Rules:
1. Create concise headlines (not detailed text) for each slide
2. If the content mentions a list of 3-5 items, create TWO slides:
   - First: A headline slide describing the list topic (e.g., "3 steps to a stronger body")
   - Second: A bullet points slide with the items (e.g., "Exercise", "Eat well", "Sleep well")
3. For other content, create regular headline slides
4. Match the number of slides to fit the template structure
${slideCountRule ? '\n' + slideCountRule + '\n' : ''}

Return a JSON array where each object has:
- "section": the section name it belongs to
- "content": the headline text
- "layout": either "default" or "bulletpoints" (use bulletpoints for lists)

Example format:
[
  {"section": "The Problem", "content": "3 steps to a stronger body", "layout": "default"},
  {"section": "The Problem", "content": "Exercise\\nEat well\\nSleep well", "layout": "bulletpoints"},
  {"section": "The Solution", "content": "Our fitness program", "layout": "default"}
]`

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a presentation content generator. Always return valid JSON arrays only, no additional text.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`)
      }

      const data = await response.json()
      const generatedContent = data.choices[0]?.message?.content?.trim() || ''
      
      // Parse JSON (might have markdown code blocks)
      let generatedSlides = []
      try {
        // Remove markdown code blocks if present
        const jsonMatch = generatedContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, generatedContent]
        const jsonContent = jsonMatch[1] || generatedContent
        generatedSlides = JSON.parse(jsonContent)
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', parseError)
        alert('Failed to parse generated content. Please try again.')
        setIsGenerating(false)
        return
      }

      // Build new slides array: sections + generated slides
      const newSlides = []
      let nextId = Math.max(...slides.map(s => s.id), 0) + 1

      for (const section of sections) {
        // Add the section
        newSlides.push({
          ...section,
          id: nextId++
        })

        // Add generated slides for this section
        const sectionSlides = generatedSlides.filter(s => s.section === section.content)
        for (const genSlide of sectionSlides) {
          newSlides.push({
            id: nextId++,
            content: genSlide.content,
            subtitle: '',
            imageUrl: '',
            layout: genSlide.layout || 'default',
            gradientStrength: 0.7,
            flipHorizontal: false,
            backgroundOpacity: 0.6,
            gradientFlipped: false,
            imageScale: 1.0,
            imagePositionX: 50,
            imagePositionY: 50,
            textHeadingLevel: null,
            subtitleHeadingLevel: null,
            webcamEnabled: false,
            selectedCameraId: ''
          })
        }
      }

      // Update slides
      onUpdateSlides(newSlides)
      alert(`Generated ${generatedSlides.length} slides based on your input!`)
    } catch (error) {
      console.error('Error generating slides:', error)
      alert(`Error generating slides: ${error.message}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const editingContextKey = () => (isOverview && editingChapterId != null ? editingChapterId : editingId)

  const renderSceneRows = (slidesForList, chapterId) =>
    slidesForList.map((slide, index) => {
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = slide.content || ''
      const displayText = tempDiv.textContent || tempDiv.innerText || ''
      const isEditing = (chapterId != null && isOverview)
        ? (editingChapterId === chapterId && editingId === slide.id)
        : (editingId === slide.id)
      const isSection = slide.layout === 'section'
      const isDragging = draggedId === slide.id
      const isDragOver = dragOverId === slide.id
      return (
        <div
          key={slide.id}
          className={`plan-scene ${isSection ? 'plan-section' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
          draggable={!isEditing}
          onDragStart={(e) => handleDragStart(e, slide.id, chapterId)}
          onDragOver={(e) => handleDragOver(e, slide.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, slide.id, chapterId)}
          onDragEnd={handleDragEnd}
          onClick={() => !isEditing && handleSceneClick(slide, chapterId)}
        >
          <span className="scene-number">{isSection ? 'Section' : `Slide ${index + 1}`}</span>
          <div className="scene-separator" />
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="scene-input"
              value={editContent}
              onChange={handleChange}
              onBlur={handleBlur}
              onKeyDown={(e) => handleKeyDown(e, slide.id)}
              onClick={(e) => e.stopPropagation()}
              rows={1}
              style={{ minHeight: '1.5em', height: 'auto', resize: 'none', overflow: 'hidden' }}
            />
          ) : (
            <span className="scene-text">
              {displayText.split('\n').map((line, i) => (
                <span key={i}>{line}{i < displayText.split('\n').length - 1 && <br />}</span>
              )) || 'Click to edit...'}
            </span>
          )}
          {slidesForList.length > 1 && (
            <button
              type="button"
              className="plan-scene-delete"
              onClick={(e) => handleDelete(slide.id, e, chapterId)}
              title={isSection ? 'Delete section' : 'Delete slide'}
              aria-label={isSection ? 'Delete section' : 'Delete slide'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>
          )}
        </div>
      )
    })

  return (
    <div className={`plan-mode ${showTemplates ? 'templates-visible' : ''} ${planView === 'overview' ? 'plan-view-overview' : ''}`}>
      <div className="plan-view-switcher">
        <button
          type="button"
          className={`plan-view-btn ${planView === 'standard' ? 'active' : ''}`}
          onClick={() => setPlanView('standard')}
        >
          Plan
        </button>
        <button
          type="button"
          className={`plan-view-btn ${planView === 'overview' ? 'active' : ''}`}
          onClick={() => setPlanView('overview')}
        >
          Overview
        </button>
      </div>
      {planView === 'standard' && (
        <div className="plan-header-row">
          <div className="plan-header-spacer" />
          <div className="plan-slide-tips-anchor">
            <label className="plan-slide-tips-toggle">
              <input
                type="checkbox"
                checked={showSlideTips}
                onChange={(e) => setShowSlideTips(e.target.checked)}
                className="plan-slide-tips-checkbox"
              />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18h6M9 14h6M9 6h.01M9 10h.01M15 10V6a2 2 0 0 0-2-2H11a2 2 0 0 0-2 2v4M12 22c-3 0-5-1.5-5-4v-2h10v2c0 2.5-2 4-5 4z" />
              </svg>
              <span>Slide tips</span>
            </label>
          </div>
        </div>
      )}
      <div className="plan-layout">
        {planView === 'standard' && onLoadTemplate && (
          <div className={`plan-templates-sidebar ${showTemplates ? 'expanded' : ''}`}>
            <button 
              className="plan-templates-toggle"
              onClick={() => setShowTemplates(!showTemplates)}
              title={showTemplates ? 'Hide templates' : 'Show templates'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span>Templates</span>
            </button>
            {showTemplates && (
              <div className="plan-templates-content">
                <TemplateSelector 
                  onLoadTemplate={(templateSlides, templateKey) => {
                    const sections = templateSlides.filter(s => s.layout === 'section')
                    setSelectedTemplate(sections.map(s => s.content))
                    if (templateKey) setSelectedTemplateKey(templateKey)
                    onLoadTemplate(templateSlides)
                  }} 
                />
              </div>
            )}
            <button 
              className="plan-generate-toggle"
              onClick={() => setShowGenerate(!showGenerate)}
              title={showGenerate ? 'Hide generate' : 'Show generate'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              <span>Generate Presentation</span>
            </button>
            {showGenerate && (
              <div className="plan-generate-content show">
                <div className="plan-generate-section">
                  <div className="plan-ramble-section">
                    <div className="plan-ramble-controls">
                      <label className="plan-ramble-label">Microphone</label>
                      <div className="plan-ramble-select-wrapper">
                        <select
                          className="plan-ramble-select"
                          value={selectedMicrophone || ''}
                          onChange={(e) => setSelectedMicrophone(e.target.value)}
                          disabled={isRecording}
                        >
                          {availableMicrophones.map((mic) => (
                            <option key={mic.deviceId} value={mic.deviceId}>
                              {mic.label || `Microphone ${availableMicrophones.indexOf(mic) + 1}`}
                            </option>
                          ))}
                        </select>
                        <button
                          className="plan-ramble-refresh"
                          onClick={loadMicrophones}
                          disabled={isRecording}
                          title="Refresh microphones"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                            <path d="M21 3v5h-5" />
                            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                            <path d="M3 21v-5h5" />
                          </svg>
                        </button>
                      </div>
                      <button
                        className={`plan-ramble-btn ${isRecording ? 'recording' : ''}`}
                        onClick={isRecording ? handleStopRecording : handleStartRecording}
                        disabled={isTranscribing || !settings?.openaiKey}
                      >
                        {isTranscribing ? (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <path d="M12 6v6l4 2" />
                            </svg>
                            <span>Transcribing...</span>
                          </>
                        ) : isRecording ? (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="6" y="6" width="12" height="12" rx="2" />
                            </svg>
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            <span>Ramble</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="plan-generate-section plan-slide-count-row">
                    <label className="plan-ramble-label">Number of slides</label>
                    <div className="plan-ramble-select-wrapper">
                      <select
                        className="plan-ramble-select"
                        value={slideCount}
                        onChange={(e) => setSlideCount(e.target.value)}
                        disabled={isGenerating}
                      >
                        <option value="">Not defined</option>
                        <option value="5">5</option>
                        <option value="10">10</option>
                        <option value="15">15</option>
                        <option value="20">20</option>
                        <option value="30">30</option>
                        <option value="40">40</option>
                        <option value="50">50</option>
                      </select>
                    </div>
                  </div>
                  <textarea
                    className="plan-generate-input"
                    placeholder="Enter your content or topic here..."
                    value={generateInput}
                    onChange={(e) => setGenerateInput(e.target.value)}
                    rows={4}
                  />
                  <button
                    className="plan-generate-btn"
                    onClick={handleGenerateSlides}
                    disabled={!generateInput.trim() || !selectedTemplate || isGenerating || !settings?.openaiKey}
                  >
                    {isGenerating ? 'Generating...' : 'Generate'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="plan-slides-center">
          <div className="plan-slides-area plan-slides-card">
          <div className="plan-standard-column">
            {planView === 'standard' && (
            <div className="plan-title-bar">
              <span className="plan-title-bar-icon" aria-hidden>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </span>
              {currentChapter && editingChapterId === currentChapter.id ? (
                <input
                  ref={chapterNameInputRef}
                  type="text"
                  className="plan-title-bar-input"
                  value={editingChapterName}
                  onChange={(e) => setEditingChapterName(e.target.value)}
                  onBlur={saveChapterName}
                  onKeyDown={handleChapterNameKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Chapter title"
                />
              ) : (
                <span
                  className="plan-title-bar-text"
                  onClick={currentChapter && onUpdateChapterName ? () => startEditingChapterName(currentChapter) : undefined}
                  title={currentChapter && onUpdateChapterName ? 'Click to edit chapter title' : undefined}
                >
                  {currentChapter?.name?.trim() || 'Untitled chapter'}
                </span>
              )}
            </div>
            )}
            <div className={`plan-standard-row ${showSlideTips ? 'with-tips-panel' : ''}`}>
              {planView === 'overview' && chapters?.length ? (
                <div className="plan-overview-scroll">
                  {chapters.map((chapter) => (
              <div
                key={chapter.id}
                className={`plan-overview-column ${draggedChapterId === chapter.id ? 'plan-overview-column-dragging' : ''} ${dragOverChapterId === chapter.id ? 'plan-overview-column-drag-over' : ''}`}
                onDragOver={(e) => handleChapterDragOver(e, chapter.id)}
                onDragLeave={handleChapterDragLeave}
                onDrop={(e) => handleChapterDrop(e, chapter.id)}
                onDragEnd={handleChapterDragEnd}
              >
                <div className="plan-overview-column-header">
                  <span
                    className="plan-overview-column-drag-handle"
                    draggable
                    onDragStart={(e) => handleChapterDragStart(e, chapter.id)}
                    title="Drag to reorder chapter"
                    aria-label="Drag to reorder"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="5" r="1" />
                      <circle cx="9" cy="12" r="1" />
                      <circle cx="9" cy="19" r="1" />
                      <circle cx="15" cy="5" r="1" />
                      <circle cx="15" cy="12" r="1" />
                      <circle cx="15" cy="19" r="1" />
                    </svg>
                  </span>
                  {editingChapterId === chapter.id ? (
                    <input
                      ref={chapterNameInputRef}
                      type="text"
                      className="plan-overview-column-title-input"
                      value={editingChapterName}
                      onChange={(e) => setEditingChapterName(e.target.value)}
                      onBlur={saveChapterName}
                      onKeyDown={handleChapterNameKeyDown}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className="plan-overview-column-title"
                      onClick={() => startEditingChapterName(chapter)}
                      title="Click to edit chapter name"
                    >
                      {chapter.name}
                    </span>
                  )}
                </div>
                <div className={`plan-scenes-list plan-overview-column-list ${showSlideTips ? 'with-tips' : ''}`}>
                  {renderSceneRows(chapter.slides, chapter.id)}
                  <div className="add-buttons-container">
                    <button type="button" className="add-scene-btn" onClick={() => handleAddScene(chapter.id)}>
                      + Add slide
                    </button>
                    <button type="button" className="add-scene-btn add-section-btn" onClick={() => handleAddSection(chapter.id)}>
                      + Add section
                    </button>
                  </div>
                </div>
              </div>
            ))}
                </div>
              ) : (
          <div className="plan-standard-column">
            <div className={`plan-standard-row ${showSlideTips ? 'with-tips-panel' : ''}`}>
              {showSlideTips && (
                <div className="plan-tips-panel">
                  <div className="plan-tips-panel-title">Slide tips</div>
                  {slides
                    .filter((slide) => slide.layout === 'section')
                    .map((slide) => {
                      const sectionTip = selectedTemplateKey && SECTION_TIPS[selectedTemplateKey]
                        ? SECTION_TIPS[selectedTemplateKey][(slide.content || '').trim()]
                        : null
                      if (!sectionTip) return null
                      return (
                        <div key={slide.id} className="plan-tip-card">
                          <div className="plan-tip-card-section">{slide.content}</div>
                          <p className="scene-tips-about">{sectionTip.about}</p>
                          <p className="scene-tips-perform">This will perform extra well if you {sectionTip.performWell}</p>
                        </div>
                      )
                    })}
                </div>
              )}
              <div className="plan-scenes-list-wrap">
                <div className="plan-scenes-list">
                  {renderSceneRows(slides)}
                  <div className="add-buttons-container">
                    <button type="button" className="add-scene-btn" onClick={() => handleAddScene()}>
                      + Add slide
                    </button>
                    <button type="button" className="add-scene-btn add-section-btn" onClick={() => handleAddSection()}>
                      + Add section
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
              )}
            </div>
          </div>
        </div>
        </div>
        {planView === 'overview' && (
          <div className="plan-slide-tips-anchor">
            <label className="plan-slide-tips-toggle">
              <input
                type="checkbox"
                checked={showSlideTips}
                onChange={(e) => setShowSlideTips(e.target.checked)}
                className="plan-slide-tips-checkbox"
              />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18h6M9 14h6M9 6h.01M9 10h.01M15 10V6a2 2 0 0 0-2-2H11a2 2 0 0 0-2 2v4M12 22c-3 0-5-1.5-5-4v-2h10v2c0 2.5-2 4-5 4z" />
              </svg>
              <span>Slide tips</span>
            </label>
          </div>
        )}
      </div>
    </div>
  )
}

export default PlanMode

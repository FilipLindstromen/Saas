import { useState, useEffect, useRef } from 'react'
import TemplateSelector from './TemplateSelector'
import './PlanMode.css'

function PlanMode({ slides, onUpdateSlides, onLoadTemplate, showTemplates = false, setShowTemplates, settings }) {
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [draggedId, setDraggedId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
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
  const textareaRef = useRef(null)
  const lastEnterTimeRef = useRef(0)

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
  }, [editingId, editContent])

  const handleAddScene = () => {
    // Save current edit before adding new slide
    if (editingId !== null) {
      const updatedSlides = slides.map(slide => 
        slide.id === editingId 
          ? { ...slide, content: editContent }
          : slide
      )
      onUpdateSlides(updatedSlides)
    }
    
    const newId = Math.max(...slides.map(s => s.id), 0) + 1
    const newSlide = {
      id: newId,
      content: '',
      subtitle: '',
      imageUrl: '',
      layout: 'default',
      gradientStrength: 0.7,
      flipHorizontal: false,
      backgroundOpacity: 1.0,
      gradientFlipped: false,
      imageScale: 1.0,
      imagePositionX: 50,
      imagePositionY: 50,
      textHeadingLevel: null,
      subtitleHeadingLevel: null
    }
    onUpdateSlides([...slides, newSlide])
    setEditingId(newId)
    setEditContent('')
  }

  const handleAddSection = () => {
    // Save current edit before adding new section
    if (editingId !== null) {
      const updatedSlides = slides.map(slide => 
        slide.id === editingId 
          ? { ...slide, content: editContent }
          : slide
      )
      onUpdateSlides(updatedSlides)
    }
    
    const newId = Math.max(...slides.map(s => s.id), 0) + 1
    const newSection = {
      id: newId,
      content: 'Section Name',
      subtitle: '',
      imageUrl: '',
      layout: 'section',
      gradientStrength: 0.7,
      flipHorizontal: false,
      backgroundOpacity: 1.0,
      gradientFlipped: false,
      imageScale: 1.0,
      imagePositionX: 50,
      imagePositionY: 50,
      textHeadingLevel: null,
      subtitleHeadingLevel: null
    }
    onUpdateSlides([...slides, newSection])
    setEditingId(newId)
    setEditContent('Section Name')
  }

  const handleSceneClick = (slide) => {
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
      const updatedSlides = slides.map(slide => 
        slide.id === editingId 
          ? { ...slide, content: newContent }
          : slide
      )
      onUpdateSlides(updatedSlides)
    }
  }

  const handleBlur = () => {
    // Save on blur
    if (editingId !== null) {
      const updatedSlides = slides.map(slide => 
        slide.id === editingId 
          ? { ...slide, content: editContent }
          : slide
      )
      onUpdateSlides(updatedSlides)
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
        
        // Split content: everything before the last newline goes to current slide
        const contentForCurrentSlide = textBeforeCursor.slice(0, -1) // Remove the last newline
        const contentForNewSlide = textAfterCursor.trim()
        
        // Update current slide with content before the double newline
        const updatedSlides = slides.map(slide => 
          slide.id === editingId 
            ? { ...slide, content: contentForCurrentSlide }
            : slide
        )
        
        // Create new slide
        const newId = Math.max(...updatedSlides.map(s => s.id), 0) + 1
        const newSlide = {
          id: newId,
          content: contentForNewSlide,
          subtitle: '',
          imageUrl: '',
          layout: 'default',
          gradientStrength: 0.7,
          flipHorizontal: false,
          backgroundOpacity: 1.0,
          gradientFlipped: false,
          imageScale: 1.0,
          imagePositionX: 50,
          imagePositionY: 50,
          textHeadingLevel: null,
          subtitleHeadingLevel: null
        }
        
        const finalSlides = [...updatedSlides, newSlide]
        onUpdateSlides(finalSlides)
        
        // Move editing to new slide
        setEditingId(newId)
        setEditContent(contentForNewSlide)
        
        // Focus the new textarea after a brief delay
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus()
            const length = contentForNewSlide.length
            textareaRef.current.setSelectionRange(length, length)
          }
        }, 0)
      } else {
        // Single Enter - allow default behavior (line break)
        lastEnterTimeRef.current = now
      }
    } else if (e.key === 'Escape') {
      // Save before exiting edit mode
      if (editingId !== null) {
        const updatedSlides = slides.map(slide => 
          slide.id === editingId 
            ? { ...slide, content: editContent }
            : slide
        )
        onUpdateSlides(updatedSlides)
      }
      setEditingId(null)
      setEditContent('')
    }
  }

  const handleDelete = (slideId, e) => {
    e.stopPropagation()
    if (slides.length > 1) {
      onUpdateSlides(slides.filter(s => s.id !== slideId))
    }
  }

  const handleDragStart = (e, slideId) => {
    if (editingId === slideId) {
      e.preventDefault()
      return
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

  const handleDrop = (e, targetSlideId) => {
    e.preventDefault()
    setDragOverId(null)
    
    if (!draggedId || draggedId === targetSlideId) {
      setDraggedId(null)
      return
    }

    // Save current edit before reordering
    if (editingId !== null) {
      const savedSlides = slides.map(slide => 
        slide.id === editingId 
          ? { ...slide, content: editContent }
          : slide
      )
      onUpdateSlides(savedSlides)
      setEditingId(null)
      setEditContent('')
    }

    // Reorder slides
    const draggedIndex = slides.findIndex(s => s.id === draggedId)
    const targetIndex = slides.findIndex(s => s.id === targetSlideId)
    
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedId(null)
      return
    }

    const newSlides = [...slides]
    const [draggedSlide] = newSlides.splice(draggedIndex, 1)
    newSlides.splice(targetIndex, 0, draggedSlide)
    
    onUpdateSlides(newSlides)
    setDraggedId(null)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverId(null)
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
      const prompt = `You are creating a presentation based on the following template structure with these sections: ${sectionsList}

User input: ${generateInput}

Generate slide content for each section. Rules:
1. Create concise headlines (not detailed text) for each slide
2. If the content mentions a list of 3-5 items, create TWO slides:
   - First: A headline slide describing the list topic (e.g., "3 steps to a stronger body")
   - Second: A bullet points slide with the items (e.g., "Exercise", "Eat well", "Sleep well")
3. For other content, create regular headline slides
4. Match the number of slides to fit the template structure

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
            backgroundOpacity: 1.0,
            gradientFlipped: false,
            imageScale: 1.0,
            imagePositionX: 50,
            imagePositionY: 50,
            textHeadingLevel: null,
            subtitleHeadingLevel: null
          })
        }
      }

      // Update slides
      onUpdateSlides(newSlides)
      setGenerateInput('')
      alert(`Generated ${generatedSlides.length} slides based on your input!`)
    } catch (error) {
      console.error('Error generating slides:', error)
      alert(`Error generating slides: ${error.message}`)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className={`plan-mode ${showTemplates ? 'templates-visible' : ''}`}>
      <div className="plan-layout">
        {onLoadTemplate && (
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
                  onLoadTemplate={(templateSlides) => {
                    // Track which template was loaded by checking section names
                    const sections = templateSlides.filter(s => s.layout === 'section')
                    setSelectedTemplate(sections.map(s => s.content))
                    onLoadTemplate(templateSlides)
                  }} 
                />
              </div>
            )}
            <div className="plan-generate-section">
              <h3 className="plan-generate-title">Generate Presentation</h3>
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
        <div className="plan-scenes-list">
        {slides.map((slide, index) => {
          // Remove HTML tags for display
          const tempDiv = document.createElement('div')
          tempDiv.innerHTML = slide.content || ''
          const displayText = tempDiv.textContent || tempDiv.innerText || ''
          
          const isEditing = editingId === slide.id
          const isSection = slide.layout === 'section'
          
          const isDragging = draggedId === slide.id
          const isDragOver = dragOverId === slide.id
          
          return (
            <div 
              key={slide.id} 
              className={`plan-scene ${isSection ? 'plan-section' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
              draggable={!isEditing}
              onDragStart={(e) => handleDragStart(e, slide.id)}
              onDragOver={(e) => handleDragOver(e, slide.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, slide.id)}
              onDragEnd={handleDragEnd}
              onClick={() => !isEditing && handleSceneClick(slide)}
            >
              <span className="scene-number">{isSection ? 'Section' : `Slide ${index + 1}`}</span>
              <div className="scene-separator"></div>
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
                  style={{ 
                    minHeight: '1.5em',
                    height: 'auto',
                    resize: 'none',
                    overflow: 'hidden'
                  }}
                />
              ) : (
                <span className="scene-text">
                  {displayText.split('\n').map((line, i) => (
                    <span key={i}>
                      {line}
                      {i < displayText.split('\n').length - 1 && <br />}
                    </span>
                  )) || 'Click to edit...'}
                </span>
              )}
            </div>
          )
        })}
        <div className="add-buttons-container">
          <button className="add-scene-btn" onClick={handleAddScene}>
            + Add slide
          </button>
          <button className="add-scene-btn add-section-btn" onClick={handleAddSection}>
            + Add section
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}

export default PlanMode

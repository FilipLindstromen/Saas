import { useState, useEffect, useRef } from 'react'
import './PlanMode.css'

function PlanMode({ slides, onUpdateSlides }) {
  const [content, setContent] = useState('')
  const textareaRef = useRef(null)

  // Initialize content from slides
  useEffect(() => {
    const slideTexts = slides.map(slide => {
      // Remove HTML tags for plan mode
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = slide.content || ''
      return tempDiv.textContent || tempDiv.innerText || ''
    }).filter(text => text.trim().length > 0)
    
    setContent(slideTexts.join('\n\n'))
  }, [])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const textarea = textareaRef.current
      const cursorPos = textarea.selectionStart
      const textBefore = content.substring(0, cursorPos)
      const textAfter = content.substring(cursorPos)
      
      // Check if there's a double newline before cursor (within last 2 chars)
      const lastChars = textBefore.slice(-2)
      
      if (lastChars === '\n\n' || (lastChars.endsWith('\n') && textBefore.slice(-3, -1) === '\n\n')) {
        // Double enter - create new slide
        e.preventDefault()
        const lines = content.split('\n\n').filter(line => line.trim().length > 0)
        const currentLineIndex = textBefore.split('\n\n').length - 1
        
        // Update slides
        const newSlides = lines.map((line, index) => ({
          id: slides[index]?.id || index + 1,
          content: line.trim(),
          imageUrl: slides[index]?.imageUrl || '',
          layout: slides[index]?.layout || 'default',
          gradientStrength: slides[index]?.gradientStrength !== undefined ? slides[index].gradientStrength : 0.7,
          flipHorizontal: slides[index]?.flipHorizontal !== undefined ? slides[index].flipHorizontal : false,
          backgroundOpacity: slides[index]?.backgroundOpacity !== undefined ? slides[index].backgroundOpacity : 1.0,
          gradientFlipped: slides[index]?.gradientFlipped !== undefined ? slides[index].gradientFlipped : false
        }))
        
        // Add empty slide if needed
        if (currentLineIndex >= lines.length - 1) {
          const newId = Math.max(...newSlides.map(s => s.id), 0) + 1
          newSlides.push({
            id: newId,
            content: '',
            imageUrl: '',
            layout: 'default',
            gradientStrength: 0.7,
            flipHorizontal: false,
            backgroundOpacity: 1.0,
            gradientFlipped: false
          })
        }
        
        onUpdateSlides(newSlides)
        
        // Update content
        const newContent = lines.join('\n\n') + '\n\n'
        setContent(newContent)
        
        // Set cursor position
        setTimeout(() => {
          textarea.setSelectionRange(newContent.length, newContent.length)
        }, 0)
      }
      // Single enter - just allow normal line break
    }
  }

  const handleChange = (e) => {
    setContent(e.target.value)
    
    // Auto-update slides on change (debounced)
    const lines = e.target.value.split('\n\n').filter(line => line.trim().length > 0)
    if (lines.length > 0) {
      const newSlides = lines.map((line, index) => ({
        id: slides[index]?.id || index + 1,
        content: line.trim(),
        imageUrl: slides[index]?.imageUrl || '',
        layout: slides[index]?.layout || 'default',
        gradientStrength: slides[index]?.gradientStrength !== undefined ? slides[index].gradientStrength : 0.7,
        flipHorizontal: slides[index]?.flipHorizontal !== undefined ? slides[index].flipHorizontal : false,
        backgroundOpacity: slides[index]?.backgroundOpacity !== undefined ? slides[index].backgroundOpacity : 1.0
      }))
      onUpdateSlides(newSlides)
    }
  }

  return (
    <div className="plan-mode">
      <div className="plan-header">
        <h2>Plan Your Slides</h2>
        <p className="plan-hint">Press Enter twice to create a new slide</p>
      </div>
      <div className="plan-content">
        <div className="plan-scenes">
          {content.split('\n\n').map((scene, index) => {
            const sceneText = scene.trim()
            if (!sceneText) return null
            return (
              <div key={index} className="plan-scene">
                <span className="scene-number">Scene {index + 1}</span>
                <div className="scene-separator"></div>
                <span className="scene-text">{sceneText}</span>
              </div>
            )
          })}
        </div>
        <textarea
          ref={textareaRef}
          className="plan-textarea"
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Start typing your slides...&#10;&#10;Press Enter twice to create a new slide"
        />
      </div>
    </div>
  )
}

export default PlanMode

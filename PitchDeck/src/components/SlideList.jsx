import { useState, useRef } from 'react'
import LayoutSelector from './LayoutSelector'
import ContextMenu from './ContextMenu'
import './SlideList.css'

function SlideList({ slides, selectedSlideId, selectedSlides = new Set(), setSelectedSlides = () => {}, onSelect, onAdd, onDelete, onDuplicate, onUpdate, onReorder, chapters, currentChapterId, onMoveToChapter }) {
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [editingSubtitle, setEditingSubtitle] = useState(false)
  const [editSubtitle, setEditSubtitle] = useState('')
  const [textAreaRef, setTextAreaRef] = useState(null)
  const [subtitleTextAreaRef, setSubtitleTextAreaRef] = useState(null)
  const [foldedSections, setFoldedSections] = useState(new Set())
  const [draggedId, setDraggedId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const dragStartTimeRef = useRef(null)

  // Strip HTML to plain text so edit fields show readable text, not raw tags
  const getPlainText = (content) => {
    if (!content || typeof content !== 'string') return ''
    return content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<div[^>]*>\s*/gi, '\n')
      .replace(/<\/div>\s*/gi, '')
      .replace(/<p[^>]*>\s*/gi, '\n')
      .replace(/<\/p>\s*/gi, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
  }

  // Convert plain text (with \n) to HTML with <br> for storage - ensures line breaks work in presentation
  const plainTextToStorage = (text) => {
    if (!text || typeof text !== 'string') return ''
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
  }

  const handleEdit = (slide) => {
    setEditingId(slide.id)
    setEditContent(getPlainText(slide.content))
    setEditSubtitle(getPlainText(slide.subtitle || ''))
    setEditingSubtitle(false)
    setSelectedSlides(new Set([slide.id]))
    if (onSelect) onSelect(slide.id)
  }

  const handleChange = (e, id) => {
    const newContent = e.target.value
    setEditContent(newContent)
    // Convert \n to <br> for storage so line breaks work in presentation mode
    onUpdate(id, { content: plainTextToStorage(newContent) })
  }

  const handleSubtitleChange = (e, id) => {
    const newSubtitle = e.target.value
    setEditSubtitle(newSubtitle)
    onUpdate(id, { subtitle: plainTextToStorage(newSubtitle) })
  }

  const handleBlur = (e) => {
    // Don't close edit mode if focus is moving to another input in the same edit session
    setTimeout(() => {
      const activeElement = document.activeElement
      const isFocusingSubtitle = activeElement === subtitleTextAreaRef
      const isFocusingMain = activeElement === textAreaRef
      if (!isFocusingSubtitle && !isFocusingMain) {
        setEditingId(null)
        setEditingSubtitle(false)
      }
    }, 100)
  }

  const handleSubtitleBlur = (e) => {
    // Don't close edit mode if focus is moving to main textarea
    setTimeout(() => {
      const activeElement = document.activeElement
      const isFocusingMain = activeElement === textAreaRef
      
      // Only close edit mode if focus is not on main textarea
      if (!isFocusingMain) {
        setEditingId(null)
        setEditingSubtitle(false)
      }
    }, 0)
  }

  const handleKeyDown = (e, id) => {
    // Allow Enter to create new lines naturally in textarea
    // Only handle Escape to exit edit mode
    if (e.key === 'Escape') {
      // Revert to original content (plain text) and exit edit mode
      const slide = slides.find(s => s.id === id)
      if (slide) {
        setEditContent(getPlainText(slide.content))
      }
      setEditingId(null)
    }
  }

  const getIdsToUpdate = () => {
    if (selectedSlides.size > 0) return Array.from(selectedSlides)
    if (selectedSlideId) return [selectedSlideId]
    return []
  }

  const handleLayoutSelect = (layoutId) => {
    const ids = getIdsToUpdate()
    const updates = layoutId === 'section'
      ? { layout: layoutId, imageUrl: '' }
      : { layout: layoutId }
    ids.forEach((id) => onUpdate(id, updates))
  }

  const toggleSectionFold = (sectionId) => {
    setFoldedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId)
      } else {
        newSet.add(sectionId)
      }
      return newSet
    })
  }

  // Filter slides based on section fold state
  const getVisibleSlides = () => {
    const visibleSlides = []
    let hideUntilNextSection = false
    
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i]
      const isSection = slide.layout === 'section'
      
      if (isSection) {
        hideUntilNextSection = foldedSections.has(slide.id)
        visibleSlides.push(slide)
      } else if (!hideUntilNextSection) {
        visibleSlides.push(slide)
      }
    }
    
    return visibleSlides
  }

  const handleDragStart = (e, slideId) => {
    if (editingId === slideId) {
      e.preventDefault()
      return
    }
    setDraggedId(slideId)
    dragStartTimeRef.current = Date.now()
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

    // Check if dropping on a chapter tab
    const chapterTab = e.target.closest('.chapter-tab')
    if (chapterTab && onMoveToChapter && chapters) {
      const chapterId = parseInt(chapterTab.dataset.chapterId)
      if (chapterId) {
        onMoveToChapter(draggedId, chapterId)
        setDraggedId(null)
        return
      }
    }

    // Regular reorder within same chapter
    if (onReorder) {
      const draggedIndex = slides.findIndex(s => s.id === draggedId)
      const targetIndex = slides.findIndex(s => s.id === targetSlideId)
      
      if (draggedIndex === -1 || targetIndex === -1) {
        setDraggedId(null)
        return
      }

      const newSlides = [...slides]
      const [removed] = newSlides.splice(draggedIndex, 1)
      newSlides.splice(targetIndex, 0, removed)
      onReorder(newSlides)
    }
    setDraggedId(null)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverId(null)
    // Clear drag start time after a short delay to prevent click after drag
    setTimeout(() => {
      dragStartTimeRef.current = null
    }, 100)
  }

  const handleContextMenu = (e, slideId) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, slideId })
  }

  const handleAddAfter = (slideId) => {
    const slideIndex = slides.findIndex(s => s.id === slideId)
    if (slideIndex !== -1 && onAdd) {
      // Create new slide after current
      const newId = Math.max(...slides.map(s => s.id), 0) + 1
      const newSlide = { id: newId, content: '', subtitle: '', imageUrl: '', backgroundVideoUrl: '', layout: 'default', gradientStrength: 0.7, flipHorizontal: false, backgroundOpacity: 0.6, gradientFlipped: false, imageScale: 1.0, imagePositionX: 50, imagePositionY: 50, textHeadingLevel: null, subtitleHeadingLevel: null }
      const newSlides = [...slides]
      newSlides.splice(slideIndex + 1, 0, newSlide)
      if (onReorder) {
        onReorder(newSlides)
      }
      if (onSelect) {
        onSelect(newId)
      }
    }
  }

  const handleAddBefore = (slideId) => {
    const slideIndex = slides.findIndex(s => s.id === slideId)
    if (slideIndex !== -1 && onAdd) {
      // Create new slide before current
      const newId = Math.max(...slides.map(s => s.id), 0) + 1
      const newSlide = { id: newId, content: '', subtitle: '', imageUrl: '', backgroundVideoUrl: '', layout: 'default', gradientStrength: 0.7, flipHorizontal: false, backgroundOpacity: 0.6, gradientFlipped: false, imageScale: 1.0, imagePositionX: 50, imagePositionY: 50, textHeadingLevel: null, subtitleHeadingLevel: null }
      const newSlides = [...slides]
      newSlides.splice(slideIndex, 0, newSlide)
      if (onReorder) {
        onReorder(newSlides)
      }
      if (onSelect) {
        onSelect(newId)
      }
    }
  }

  const handleSlideClick = (e, slideId) => {
    // Handle multi-select with Ctrl/Cmd
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey
    
    if (cmdOrCtrl) {
      e.preventDefault()
      setSelectedSlides(prev => {
        const newSet = new Set(prev)
        if (newSet.has(slideId)) {
          newSet.delete(slideId)
        } else {
          newSet.add(slideId)
          if (onSelect) onSelect(slideId)
        }
        return newSet
      })
    } else if (e.shiftKey && selectedSlides.size > 0) {
      // Range selection with Shift
      e.preventDefault()
      const currentIndex = slides.findIndex(s => s.id === slideId)
      const selectedIndices = Array.from(selectedSlides).map(id => slides.findIndex(s => s.id === id)).filter(i => i !== -1)
      const minIndex = Math.min(...selectedIndices, currentIndex)
      const maxIndex = Math.max(...selectedIndices, currentIndex)
      const newSet = new Set()
      for (let i = minIndex; i <= maxIndex; i++) {
        newSet.add(slides[i].id)
      }
      setSelectedSlides(newSet)
      if (onSelect) onSelect(slideId)
    } else {
      // Single selection
      setSelectedSlides(new Set([slideId]))
      if (onSelect) {
        onSelect(slideId)
      }
    }
  }

  return (
    <div className="slide-list">
      <div className="slide-list-header">
        <h2>Slides</h2>
        <button className="btn-add" onClick={onAdd}>
          + Add Slide
        </button>
      </div>
      <LayoutSelector 
        onSelectLayout={handleLayoutSelect} 
        selectedLayout={(slides.find(s => s.id === (selectedSlides.size > 0 ? Array.from(selectedSlides)[0] : selectedSlideId)) || {})?.layout || 'default'}
        cameraOverrideEnabled={(slides.find(s => s.id === (selectedSlides.size > 0 ? Array.from(selectedSlides)[0] : selectedSlideId)) || {})?.cameraOverrideEnabled ?? false}
        cameraOverridePosition={(slides.find(s => s.id === (selectedSlides.size > 0 ? Array.from(selectedSlides)[0] : selectedSlideId)) || {})?.cameraOverridePosition || 'fullscreen'}
        onCameraOverrideChange={(enabled) => {
          const ids = getIdsToUpdate()
          const currentPos = slides.find(s => s.id === selectedSlideId)?.cameraOverridePosition || 'fullscreen'
          ids.forEach((id) => onUpdate(id, { cameraOverrideEnabled: enabled, cameraOverridePosition: enabled ? currentPos : undefined }))
        }}
        onCameraOverridePositionSelect={(position) => {
          const ids = getIdsToUpdate()
          ids.forEach((id) => onUpdate(id, { cameraOverridePosition: position }))
        }}
      />
      <div className="slide-list-items">
        {getVisibleSlides().map((slide, visibleIndex) => {
          const isSection = slide.layout === 'section'
          const isCentered = slide.layout === 'centered'
          const isEditing = editingId === slide.id
          const isFolded = foldedSections.has(slide.id)
          const originalIndex = slides.findIndex(s => s.id === slide.id)
          
          if (isSection) {
            return (
              <div 
                key={slide.id} 
                className={`slide-item-wrapper section-wrapper ${draggedId === slide.id ? 'dragging' : ''} ${dragOverId === slide.id ? 'drag-over' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, slide.id)}
                onDragOver={(e) => handleDragOver(e, slide.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, slide.id)}
                onDragEnd={handleDragEnd}
              >
                <div className="slide-item slide-item-section">
                  <div className="slide-item-content">
                  <div className="slide-item-text slide-item-section-text" style={{ whiteSpace: 'pre-line' }}>
                    {getPlainText(slide.content || 'Section Name')}
                  </div>
                  <div className="slide-item-actions">
                    <button
                      className="btn-fold"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSectionFold(slide.id)
                      }}
                      title={isFolded ? 'Unfold' : 'Fold'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {isFolded ? (
                          <polyline points="9 18 15 12 9 6"></polyline>
                        ) : (
                          <polyline points="6 9 12 15 18 9"></polyline>
                        )}
                      </svg>
                    </button>
                    <button
                      className="btn-duplicate"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDuplicate(slide.id)
                      }}
                      title="Duplicate section"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                    <button
                      className="btn-delete"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(slide.id)
                      }}
                      disabled={slides.length === 1}
                      title="Delete section"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            </div>
            )
          }
          
          return (
            <div 
              key={slide.id} 
              className={`slide-item-wrapper ${draggedId === slide.id ? 'dragging' : ''} ${dragOverId === slide.id ? 'drag-over' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, slide.id)}
              onDragOver={(e) => handleDragOver(e, slide.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, slide.id)}
              onDragEnd={handleDragEnd}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', width: '100%' }}>
                <div className="slide-item-number">{originalIndex + 1}</div>
                <div
                  className={`slide-item ${selectedSlideId === slide.id ? 'selected' : ''} ${selectedSlides.has(slide.id) ? 'multi-selected' : ''}`}
                  onClick={(e) => {
                    // Don't select if we just finished dragging (within 200ms)
                    const timeSinceDragStart = dragStartTimeRef.current ? Date.now() - dragStartTimeRef.current : Infinity
                    if (timeSinceDragStart > 200) {
                      handleSlideClick(e, slide.id)
                    }
                  }}
                  onContextMenu={(e) => handleContextMenu(e, slide.id)}
                >
                {slide.imageUrl && (
                  <div className="slide-item-thumbnail">
                    <img src={slide.imageUrl} alt={`Slide ${originalIndex + 1}`} />
                  </div>
                )}
                <div className="slide-item-main-content">
                {isEditing ? (
                <div className="slide-item-edit" onClick={(e) => e.stopPropagation()}>
                  <textarea
                    ref={(ref) => setTextAreaRef(ref)}
                    value={editContent}
                    onChange={(e) => handleChange(e, slide.id)}
                    onBlur={handleBlur}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => handleKeyDown(e, slide.id)}
                    autoFocus
                    className="slide-edit-input"
                    placeholder="Main text"
                  />
                  {isCentered && (
                    <textarea
                      ref={(ref) => setSubtitleTextAreaRef(ref)}
                      value={editSubtitle}
                      onChange={(e) => handleSubtitleChange(e, slide.id)}
                      onBlur={handleSubtitleBlur}
                      onClick={(e) => e.stopPropagation()}
                      onFocus={(e) => {
                        e.stopPropagation()
                        setEditingSubtitle(true)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          return
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          subtitleTextAreaRef?.blur()
                          return
                        }
                        handleKeyDown(e, slide.id)
                      }}
                      className="slide-edit-input slide-edit-subtitle"
                      placeholder="Subtitle (optional)"
                    />
                  )}
                </div>
              ) : (
                <div className="slide-item-content">
                  <div
                    className="slide-item-text"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEdit(slide)
                    }}
                    style={{ whiteSpace: 'pre-line' }}
                  >
                    <div>{getPlainText(slide.content || 'Empty slide')}</div>
                    {isCentered && slide.subtitle && (
                      <div className="slide-item-subtitle">
                        {getPlainText(slide.subtitle)}
                      </div>
                    )}
                  </div>
                  <div className="slide-item-actions">
                    <button
                      className="btn-duplicate"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDuplicate(slide.id)
                      }}
                      title="Duplicate slide"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                    <button
                      className="btn-delete"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(slide.id)
                      }}
                      disabled={slides.length === 1}
                      title="Delete slide"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
                </div>
              </div>
              </div>
            </div>
          )
        })}
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onDuplicate={() => onDuplicate(contextMenu.slideId)}
          onDelete={() => onDelete(contextMenu.slideId)}
          onAddAfter={() => handleAddAfter(contextMenu.slideId)}
          onAddBefore={() => handleAddBefore(contextMenu.slideId)}
        />
      )}
    </div>
  )
}

export default SlideList

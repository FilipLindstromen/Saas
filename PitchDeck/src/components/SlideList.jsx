import { useState, useRef } from 'react'
import LayoutSelector from './LayoutSelector'
import './SlideList.css'

function SlideList({ slides, selectedSlideId, onSelect, onAdd, onDelete, onDuplicate, onUpdate, onReorder }) {
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [editingSubtitle, setEditingSubtitle] = useState(false)
  const [editSubtitle, setEditSubtitle] = useState('')
  const [textAreaRef, setTextAreaRef] = useState(null)
  const [subtitleTextAreaRef, setSubtitleTextAreaRef] = useState(null)
  const [foldedSections, setFoldedSections] = useState(new Set())
  const [isFormatting, setIsFormatting] = useState(false)
  const [draggedId, setDraggedId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const dragStartTimeRef = useRef(null)

  const handleEdit = (slide) => {
    setEditingId(slide.id)
    setEditContent(slide.content)
    setEditSubtitle(slide.subtitle || '')
    setEditingSubtitle(false)
  }

  const handleChange = (e, id) => {
    const newContent = e.target.value
    setEditContent(newContent)
    // Auto-save on every change
    onUpdate(id, { content: newContent })
  }

  const handleSubtitleChange = (e, id) => {
    const newSubtitle = e.target.value
    setEditSubtitle(newSubtitle)
    // Auto-save on every change
    onUpdate(id, { subtitle: newSubtitle })
  }

  const handleBlur = (e) => {
    // Don't close edit mode if we're in the middle of formatting
    if (isFormatting) {
      return
    }
    
    // Don't close edit mode if focus is moving to another input in the same edit session
    // Use setTimeout to check if focus moved to subtitle/main textarea or formatting buttons
    setTimeout(() => {
      // Check again if formatting is happening
      if (isFormatting) {
        return
      }
      
      const activeElement = document.activeElement
      const isFocusingSubtitle = activeElement === subtitleTextAreaRef
      const isFocusingMain = activeElement === textAreaRef
      
      // Check if the click was on a formatting button or toolbar
      const isFormattingButton = activeElement?.closest('.format-btn') || 
                                  activeElement?.closest('.formatting-toolbar')
      
      // Only close edit mode if focus is not on either textarea or formatting buttons
      if (!isFocusingSubtitle && !isFocusingMain && !isFormattingButton) {
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
      // Revert to original content and exit edit mode
      const slide = slides.find(s => s.id === id)
      if (slide) {
        setEditContent(slide.content)
      }
      setEditingId(null)
    }
  }

  const handleLayoutSelect = (layoutId) => {
    if (selectedSlideId) {
      // If switching to section layout, clear imageUrl
      const updates = layoutId === 'section' 
        ? { layout: layoutId, imageUrl: '' }
        : { layout: layoutId }
      onUpdate(selectedSlideId, updates)
    }
  }

  const applyFormatting = (tag, isSubtitle = false) => {
    setIsFormatting(true)
    
    const ref = isSubtitle ? subtitleTextAreaRef : textAreaRef
    const content = isSubtitle ? editSubtitle : editContent
    const setContent = isSubtitle ? setEditSubtitle : setEditContent
    
    if (!ref) {
      setIsFormatting(false)
      return
    }

    const textarea = ref
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end)

    // For heading tags, apply to entire field instead of selected text
    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      const headingProperty = isSubtitle ? 'subtitleHeadingLevel' : 'textHeadingLevel'
      const currentHeading = slides.find(s => s.id === editingId)?.[headingProperty]
      // Toggle: if already this heading, remove it; otherwise set it
      const newHeading = currentHeading === tag ? null : tag
      onUpdate(editingId, { [headingProperty]: newHeading })
      setIsFormatting(false)
      return
    }

    if (selectedText.length === 0) {
      setIsFormatting(false)
      return
    }

    const beforeText = content.substring(0, start)
    const afterText = content.substring(end)
    
    let formattedText
    if (tag === 'strong') {
      formattedText = `<strong>${selectedText}</strong>`
    } else if (tag === 'em') {
      formattedText = `<em>${selectedText}</em>`
    } else {
      setIsFormatting(false)
      return
    }

    const newContent = beforeText + formattedText + afterText
    setContent(newContent)
    
    if (isSubtitle) {
      onUpdate(editingId, { subtitle: newContent })
    } else {
      onUpdate(editingId, { content: newContent })
    }

    // Restore cursor position and focus after update
    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (textarea) {
          const newCursorPos = start + formattedText.length
          textarea.setSelectionRange(newCursorPos, newCursorPos)
          textarea.focus()
        }
        setIsFormatting(false)
      }, 0)
    })
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
    
    if (!draggedId || draggedId === targetSlideId || !onReorder) {
      setDraggedId(null)
      return
    }

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

  return (
    <div className="slide-list">
      <div className="slide-list-header">
        <h2>Slides</h2>
        <button className="btn-add" onClick={onAdd}>
          + Add Slide
        </button>
      </div>
      <LayoutSelector onSelectLayout={handleLayoutSelect} />
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
                  <div className="slide-item-text slide-item-section-text">
                    <div dangerouslySetInnerHTML={{ __html: slide.content || 'Section Name' }} />
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
              <div className="slide-item-number">{originalIndex + 1}</div>
              <div
                className={`slide-item ${selectedSlideId === slide.id ? 'selected' : ''}`}
                onClick={(e) => {
                  // Don't select if we just finished dragging (within 200ms)
                  const timeSinceDragStart = dragStartTimeRef.current ? Date.now() - dragStartTimeRef.current : Infinity
                  if (timeSinceDragStart > 200) {
                    onSelect(slide.id)
                  }
                }}
              >
                {slide.imageUrl && (
                  <div className="slide-item-thumbnail">
                    <img src={slide.imageUrl} alt={`Slide ${originalIndex + 1}`} />
                  </div>
                )}
                <div className="slide-item-main-content">
                {isEditing ? (
                <div className="slide-item-edit" onClick={(e) => e.stopPropagation()}>
                  <div className="formatting-toolbar">
                    <button
                      type="button"
                      className="format-btn"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        applyFormatting('strong', false)
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      title="Bold (Ctrl+B)"
                    >
                      <strong>B</strong>
                    </button>
                    <button
                      type="button"
                      className="format-btn"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        applyFormatting('em', false)
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      title="Italic (Ctrl+I)"
                    >
                      <em>I</em>
                    </button>
                    <button
                      type="button"
                      className={`format-btn ${slides.find(s => s.id === slide.id)?.textHeadingLevel === 'h1' ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        applyFormatting('h1', false)
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      title="Heading 1"
                    >
                      H1
                    </button>
                    <button
                      type="button"
                      className={`format-btn ${slides.find(s => s.id === slide.id)?.textHeadingLevel === 'h2' ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        applyFormatting('h2', false)
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      title="Heading 2"
                    >
                      H2
                    </button>
                    <button
                      type="button"
                      className={`format-btn ${slides.find(s => s.id === slide.id)?.textHeadingLevel === 'h3' ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        applyFormatting('h3', false)
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      title="Heading 3"
                    >
                      H3
                    </button>
                  </div>
                  <textarea
                    ref={(ref) => setTextAreaRef(ref)}
                    value={editContent}
                    onChange={(e) => handleChange(e, slide.id)}
                    onBlur={handleBlur}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      // Handle keyboard shortcuts
                      if (e.ctrlKey || e.metaKey) {
                        if (e.key === 'b') {
                          e.preventDefault()
                          applyFormatting('strong', false)
                          return
                        }
                        if (e.key === 'i') {
                          e.preventDefault()
                          applyFormatting('em', false)
                          return
                        }
                      }
                      handleKeyDown(e, slide.id)
                    }}
                    autoFocus
                    className="slide-edit-input"
                    placeholder="Main text"
                  />
                  {isCentered && (
                    <>
                      <div className="formatting-toolbar">
                        <button
                          type="button"
                          className="format-btn"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            applyFormatting('strong', true)
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                          }}
                          title="Bold (Ctrl+B)"
                        >
                          <strong>B</strong>
                        </button>
                        <button
                          type="button"
                          className="format-btn"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            applyFormatting('em', true)
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                          }}
                          title="Italic (Ctrl+I)"
                        >
                          <em>I</em>
                        </button>
                        <button
                          type="button"
                          className={`format-btn ${slides.find(s => s.id === slide.id)?.subtitleHeadingLevel === 'h1' ? 'active' : ''}`}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            applyFormatting('h1', true)
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                          }}
                          title="Heading 1"
                        >
                          H1
                        </button>
                        <button
                          type="button"
                          className={`format-btn ${slides.find(s => s.id === slide.id)?.subtitleHeadingLevel === 'h2' ? 'active' : ''}`}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            applyFormatting('h2', true)
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                          }}
                          title="Heading 2"
                        >
                          H2
                        </button>
                        <button
                          type="button"
                          className={`format-btn ${slides.find(s => s.id === slide.id)?.subtitleHeadingLevel === 'h3' ? 'active' : ''}`}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            applyFormatting('h3', true)
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                          }}
                          title="Heading 3"
                        >
                          H3
                        </button>
                      </div>
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
                          // Handle keyboard shortcuts
                          if (e.ctrlKey || e.metaKey) {
                            if (e.key === 'b') {
                              e.preventDefault()
                              applyFormatting('strong', true)
                              return
                            }
                            if (e.key === 'i') {
                              e.preventDefault()
                              applyFormatting('em', true)
                              return
                            }
                          }
                          // Don't exit edit mode on Enter or Escape when editing subtitle
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            // Just blur the subtitle, don't exit edit mode
                            return
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault()
                            // Just blur the subtitle, don't exit edit mode
                            subtitleTextAreaRef?.blur()
                            return
                          }
                        }}
                        className="slide-edit-input slide-edit-subtitle"
                        placeholder="Subtitle (optional)"
                      />
                    </>
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
                  >
                    <div dangerouslySetInnerHTML={{ __html: slide.content || 'Empty slide' }} />
                    {isCentered && slide.subtitle && (
                      <div 
                        className="slide-item-subtitle"
                        dangerouslySetInnerHTML={{ __html: slide.subtitle }}
                      />
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
          )
        })}
      </div>
    </div>
  )
}

export default SlideList

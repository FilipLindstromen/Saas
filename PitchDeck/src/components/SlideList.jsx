import { useState } from 'react'
import LayoutSelector from './LayoutSelector'
import './SlideList.css'

function SlideList({ slides, selectedSlideId, onSelect, onAdd, onDelete, onUpdate }) {
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [textAreaRef, setTextAreaRef] = useState(null)

  const handleEdit = (slide) => {
    setEditingId(slide.id)
    setEditContent(slide.content)
  }

  const handleChange = (e, id) => {
    const newContent = e.target.value
    setEditContent(newContent)
    // Auto-save on every change
    onUpdate(id, { content: newContent })
  }

  const handleBlur = () => {
    setEditingId(null)
  }

  const handleKeyDown = (e, id) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      setEditingId(null)
    } else if (e.key === 'Escape') {
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
      onUpdate(selectedSlideId, { layout: layoutId })
    }
  }

  const applyFormatting = (tag) => {
    if (!textAreaRef) return

    const textarea = textAreaRef
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = editContent.substring(start, end)

    if (selectedText.length === 0) return

    const beforeText = editContent.substring(0, start)
    const afterText = editContent.substring(end)
    
    let formattedText
    if (tag === 'strong') {
      formattedText = `<strong>${selectedText}</strong>`
    } else if (tag === 'em') {
      formattedText = `<em>${selectedText}</em>`
    } else {
      return
    }

    const newContent = beforeText + formattedText + afterText
    setEditContent(newContent)
    onUpdate(editingId, { content: newContent })

    // Restore cursor position after update
    setTimeout(() => {
      const newCursorPos = start + formattedText.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
      textarea.focus()
    }, 0)
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
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`slide-item ${selectedSlideId === slide.id ? 'selected' : ''}`}
            onClick={() => onSelect(slide.id)}
          >
            <div className="slide-item-header">
              <div className="slide-item-number">{index + 1}</div>
              {slide.imageUrl && (
                <div className="slide-item-thumbnail">
                  <img src={slide.imageUrl} alt={`Slide ${index + 1}`} />
                </div>
              )}
            </div>
            {editingId === slide.id ? (
              <div className="slide-item-edit">
                <div className="formatting-toolbar">
                  <button
                    type="button"
                    className="format-btn"
                    onClick={() => applyFormatting('strong')}
                    title="Bold (Ctrl+B)"
                  >
                    <strong>B</strong>
                  </button>
                  <button
                    type="button"
                    className="format-btn"
                    onClick={() => applyFormatting('em')}
                    title="Italic (Ctrl+I)"
                  >
                    <em>I</em>
                  </button>
                </div>
                <textarea
                  ref={(ref) => setTextAreaRef(ref)}
                  value={editContent}
                  onChange={(e) => handleChange(e, slide.id)}
                  onBlur={handleBlur}
                  onKeyDown={(e) => {
                    // Handle keyboard shortcuts
                    if (e.ctrlKey || e.metaKey) {
                      if (e.key === 'b') {
                        e.preventDefault()
                        applyFormatting('strong')
                        return
                      }
                      if (e.key === 'i') {
                        e.preventDefault()
                        applyFormatting('em')
                        return
                      }
                    }
                    handleKeyDown(e, slide.id)
                  }}
                  autoFocus
                  className="slide-edit-input"
                />
              </div>
            ) : (
              <div className="slide-item-content">
                <div
                  className="slide-item-text"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEdit(slide)
                  }}
                  dangerouslySetInnerHTML={{ __html: slide.content || 'Empty slide' }}
                />
                <button
                  className="btn-delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(slide.id)
                  }}
                  disabled={slides.length === 1}
                >
                  ×
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default SlideList

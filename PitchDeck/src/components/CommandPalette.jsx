import { useState, useEffect, useRef } from 'react'
import './CommandPalette.css'

function CommandPalette({ onClose, onAction, slides, chapters, currentChapterId }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const commands = [
    {
      id: 'undo',
      label: 'Undo',
      keywords: ['undo', 'revert'],
      action: () => onAction('undo')
    },
    {
      id: 'redo',
      label: 'Redo',
      keywords: ['redo', 'repeat'],
      action: () => onAction('redo')
    },
    {
      id: 'new-slide',
      label: 'New Slide',
      keywords: ['new', 'add', 'create', 'slide'],
      action: () => onAction('newSlide')
    },
    {
      id: 'duplicate-slide',
      label: 'Duplicate Slide',
      keywords: ['duplicate', 'copy', 'clone'],
      action: () => onAction('duplicateSlide')
    },
    {
      id: 'delete-slide',
      label: 'Delete Slide',
      keywords: ['delete', 'remove', 'trash'],
      action: () => onAction('deleteSlide')
    },
    {
      id: 'analyze',
      label: 'Analyze Slides',
      keywords: ['analyze', 'analysis', 'ai'],
      action: () => onAction('analyze')
    },
    {
      id: 'export',
      label: 'Export Project',
      keywords: ['export', 'save', 'download'],
      action: () => onAction('export')
    },
    {
      id: 'import',
      label: 'Import Project',
      keywords: ['import', 'load', 'open'],
      action: () => onAction('import')
    },
    {
      id: 'settings',
      label: 'Open Settings',
      keywords: ['settings', 'preferences', 'config'],
      action: () => onAction('settings')
    },
    {
      id: 'transitions',
      label: 'Transitions & Animations',
      keywords: ['transitions', 'animations', 'effects'],
      action: () => onAction('transitions')
    },
    {
      id: 'toggle-theme',
      label: 'Toggle Theme',
      keywords: ['theme', 'dark', 'light', 'mode'],
      action: () => onAction('toggleTheme')
    },
    {
      id: 'present',
      label: 'Start Presentation',
      keywords: ['present', 'presentation', 'play', 'show'],
      action: () => onAction('present')
    },
  ]

  // Add slide navigation commands
  const slideCommands = slides
    .filter(slide => slide.layout !== 'section')
    .slice(0, 10)
    .map((slide, index) => ({
      id: `slide-${slide.id}`,
      label: `Go to Slide ${index + 1}: ${slide.content.substring(0, 50)}${slide.content.length > 50 ? '...' : ''}`,
      keywords: ['slide', 'go', 'navigate', `slide ${index + 1}`],
      action: () => onAction('goToSlide', slide.id)
    }))

  // Add chapter navigation commands
  const chapterCommands = chapters.map(chapter => ({
    id: `chapter-${chapter.id}`,
    label: `Switch to ${chapter.name}`,
    keywords: ['chapter', 'switch', chapter.name.toLowerCase()],
    action: () => onAction('switchChapter', chapter.id)
  }))

  const allCommands = [...commands, ...slideCommands, ...chapterCommands]

  const filteredCommands = searchQuery
    ? allCommands.filter(cmd => {
        const query = searchQuery.toLowerCase()
        return (
          cmd.label.toLowerCase().includes(query) ||
          cmd.keywords.some(kw => kw.toLowerCase().includes(query))
        )
      })
    : allCommands.slice(0, 10) // Show top 10 when no search

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setSelectedIndex(0)
  }, [searchQuery])

  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const items = listRef.current.children
      if (items[selectedIndex]) {
        items[selectedIndex].scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action()
        onClose()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  const handleCommandClick = (command) => {
    command.action()
    onClose()
  }

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette-input-wrapper">
          <svg className="command-palette-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Type a command or search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        {filteredCommands.length > 0 && (
          <div className="command-palette-list" ref={listRef}>
            {filteredCommands.map((command, index) => (
              <div
                key={command.id}
                className={`command-palette-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleCommandClick(command)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="command-palette-item-label">{command.label}</div>
              </div>
            ))}
          </div>
        )}
        {filteredCommands.length === 0 && (
          <div className="command-palette-empty">No commands found</div>
        )}
      </div>
    </div>
  )
}

export default CommandPalette

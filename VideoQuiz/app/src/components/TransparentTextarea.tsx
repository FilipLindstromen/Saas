import React, { useRef, useEffect, useCallback } from 'react'

interface TransparentTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  rows?: number
  onKeyDown?: (e: React.KeyboardEvent) => void
}

export function TransparentTextarea({
  value,
  onChange,
  placeholder,
  className = '',
  rows = 2,
  onKeyDown
}: TransparentTextareaProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const isComposingRef = useRef(false)

  // Update content when value prop changes
  useEffect(() => {
    if (!contentRef.current) return
    
    // Only update if the content is different to avoid cursor jumping
    const currentText = getPlainText(contentRef.current)
    if (currentText !== value) {
      setContentFromPlainText(contentRef.current, value)
    }
    
    // Update data-empty attribute
    const isEmpty = !value || value.trim().length === 0
    contentRef.current.setAttribute('data-empty', isEmpty ? 'true' : 'false')
  }, [value])

  const getPlainText = (element: HTMLElement): string => {
    return element.innerText || element.textContent || ''
  }

  const setContentFromPlainText = (element: HTMLElement, text: string) => {
    // Save cursor position
    const selection = window.getSelection()
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null
    const cursorOffset = range ? getCursorOffset(element, range) : null

    // Set plain text
    element.textContent = text

    // Restore cursor position
    if (cursorOffset !== null && cursorOffset >= 0) {
      setCursorPosition(element, Math.min(cursorOffset, text.length))
    }
  }

  const getCursorOffset = (container: HTMLElement, range: Range): number => {
    const preCaretRange = range.cloneRange()
    preCaretRange.selectNodeContents(container)
    preCaretRange.setEnd(range.endContainer, range.endOffset)
    return preCaretRange.toString().length
  }

  const setCursorPosition = (container: HTMLElement, offset: number) => {
    const selection = window.getSelection()
    if (!selection) return

    const range = document.createRange()
    let currentOffset = 0
    let found = false

    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    )

    let node: Node | null
    while ((node = walker.nextNode())) {
      const nodeLength = node.textContent?.length || 0
      if (currentOffset + nodeLength >= offset) {
        range.setStart(node, offset - currentOffset)
        range.setEnd(node, offset - currentOffset)
        found = true
        break
      }
      currentOffset += nodeLength
    }

    if (found) {
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Call custom onKeyDown if provided
    if (onKeyDown) {
      onKeyDown(e)
    }

    // Handle IME composition (for languages like Chinese, Japanese)
    if (e.key === 'Process' || isComposingRef.current) {
      return
    }

    // Handle delete or backspace
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return

      const range = selection.getRangeAt(0)
      if (!range.collapsed) {
        // Text is selected - make selected text transparent
        const selectedText = range.toString()
        if (selectedText.length > 0) {
                  const span = document.createElement('span')
                  span.style.opacity = '0.2'
                  span.textContent = selectedText
          
          try {
            range.deleteContents()
            range.insertNode(span)
            
            // Move cursor after the inserted span
            range.setStartAfter(span)
            range.collapse(true)
            selection.removeAllRanges()
            selection.addRange(range)
            
            // Update value
            if (contentRef.current) {
              const plainText = getPlainText(contentRef.current)
              onChange(plainText)
            }
          } catch (error) {
            console.warn('Failed to make text transparent:', error)
          }
        }
      } else {
        // No selection - make character at cursor transparent
        const container = contentRef.current
        if (!container) return

        if (e.key === 'Backspace') {
          // Get character before cursor
          const preCaretRange = range.cloneRange()
          preCaretRange.selectNodeContents(container)
          preCaretRange.setEnd(range.startContainer, range.startOffset)
          const textBefore = preCaretRange.toString()
          
          if (textBefore.length > 0) {
            const charToMakeTransparent = textBefore[textBefore.length - 1]
            const charRange = range.cloneRange()
            
            // Find the text node containing the character
            const walker = document.createTreeWalker(
              container,
              NodeFilter.SHOW_TEXT,
              null
            )
            
            let node: Node | null
            let offset = 0
            while ((node = walker.nextNode())) {
              const nodeText = node.textContent || ''
              const nodeStart = offset
              const nodeEnd = offset + nodeText.length
              
              if (nodeEnd >= textBefore.length) {
                const charIndex = textBefore.length - 1 - nodeStart
                if (charIndex >= 0 && charIndex < nodeText.length) {
                  charRange.setStart(node, charIndex)
                  charRange.setEnd(node, charIndex + 1)
                  
                  const span = document.createElement('span')
                  span.style.opacity = '0.2'
                  span.textContent = charToMakeTransparent
                  
                  try {
                    charRange.deleteContents()
                    charRange.insertNode(span)
                    
                    // Move cursor after the inserted span
                    range.setStartAfter(span)
                    range.collapse(true)
                    selection.removeAllRanges()
                    selection.addRange(range)
                    
                    // Update value
                    const plainText = getPlainText(container)
                    onChange(plainText)
                  } catch (error) {
                    console.warn('Failed to make character transparent:', error)
                  }
                }
                break
              }
              offset = nodeEnd
            }
          }
        } else if (e.key === 'Delete') {
          // Get character after cursor
          const postCaretRange = range.cloneRange()
          postCaretRange.selectNodeContents(container)
          postCaretRange.setStart(range.endContainer, range.endOffset)
          const textAfter = postCaretRange.toString()
          
          if (textAfter.length > 0) {
            const charToMakeTransparent = textAfter[0]
            const charRange = range.cloneRange()
            
            // Find the text node containing the character
            const walker = document.createTreeWalker(
              container,
              NodeFilter.SHOW_TEXT,
              null
            )
            
            let node: Node | null
            let offset = 0
            const preCaretRange = range.cloneRange()
            preCaretRange.selectNodeContents(container)
            preCaretRange.setEnd(range.startContainer, range.startOffset)
            const textBefore = preCaretRange.toString()
            
            while ((node = walker.nextNode())) {
              const nodeText = node.textContent || ''
              const nodeStart = offset
              const nodeEnd = offset + nodeText.length
              
              if (nodeEnd > textBefore.length) {
                const charIndex = textBefore.length - nodeStart
                if (charIndex >= 0 && charIndex < nodeText.length) {
                  charRange.setStart(node, charIndex)
                  charRange.setEnd(node, charIndex + 1)
                  
                  const span = document.createElement('span')
                  span.style.opacity = '0.2'
                  span.textContent = charToMakeTransparent
                  
                  try {
                    charRange.deleteContents()
                    charRange.insertNode(span)
                    
                    // Keep cursor at same position
                    range.setStartBefore(span)
                    range.collapse(true)
                    selection.removeAllRanges()
                    selection.addRange(range)
                    
                    // Update value
                    const plainText = getPlainText(container)
                    onChange(plainText)
                  } catch (error) {
                    console.warn('Failed to make character transparent:', error)
                  }
                }
                break
              }
              offset = nodeEnd
            }
          }
        }
      }
    }
  }, [onChange, onKeyDown])

  const handleInput = useCallback(() => {
    if (!contentRef.current) return
    const plainText = getPlainText(contentRef.current)
    const isEmpty = !plainText || plainText.trim().length === 0
    contentRef.current.setAttribute('data-empty', isEmpty ? 'true' : 'false')
    onChange(plainText)
  }, [onChange])

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true
  }, [])

  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false
  }, [])

  // Calculate min-height based on rows
  const minHeight = rows * 1.5 * 16 // Approximate line height

  const isEmpty = !value || value.trim().length === 0

  return (
    <>
      <style>{`
        .transparent-textarea[data-empty="true"]:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
          position: absolute;
        }
      `}</style>
      <div
        ref={contentRef}
        contentEditable
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        className={`transparent-textarea ${className}`}
        data-empty={isEmpty ? 'true' : 'false'}
        data-placeholder={placeholder}
        style={{
          minHeight: `${minHeight}px`,
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          outline: 'none',
          position: 'relative'
        }}
        onBlur={() => {
          // Ensure value is synced on blur
          if (contentRef.current) {
            const plainText = getPlainText(contentRef.current)
            if (plainText !== value) {
              onChange(plainText)
            }
          }
        }}
      />
    </>
  )
}


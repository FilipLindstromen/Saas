import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import './Slide.css'
import TextFormatToolbar from './TextFormatToolbar'

// Build CSS filter string for video adjustments (shadows/midtones/highlights + color hue per zone)
function getVideoFilterFromProps({ videoBrightness = 1, videoContrast = 1, videoSaturation = 1, videoShadows = 1, videoMidtones = 1, videoHighlights = 1, videoShadowHue = 0, videoMidHue = 0, videoHighlightHue = 0 }) {
  const b = typeof videoBrightness === 'number' ? videoBrightness : 1
  const c = typeof videoContrast === 'number' ? videoContrast : 1
  const s = typeof videoSaturation === 'number' ? videoSaturation : 1
  const sh = typeof videoShadows === 'number' ? videoShadows : 1
  const m = typeof videoMidtones === 'number' ? videoMidtones : 1
  const h = typeof videoHighlights === 'number' ? videoHighlights : 1
  const shadowFactor = 1 + (sh - 1) * 0.4
  const midtoneFactor = 1 + (m - 1) * 0.3
  const highlightFactor = 1 + (h - 1) * 0.4
  const brightness = b * shadowFactor * highlightFactor
  const contrast = c * midtoneFactor
  const hueDeg = [videoShadowHue, videoMidHue, videoHighlightHue].reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0) / 3
  const huePart = hueDeg !== 0 ? ` hue-rotate(${hueDeg}deg)` : ''
  return `brightness(${brightness}) contrast(${contrast}) saturate(${s})${huePart}`
}

// Webcam component - defined outside to avoid hooks issues. Uses layout or camera override for position/scale.
function WebcamVideo({ cameraId, layout, isPlayMode, videoBrightness, videoContrast, videoSaturation, videoShadows, videoMidtones, videoHighlights, videoShadowHue, videoMidHue, videoHighlightHue, cameraOverrideEnabled = false, cameraOverridePosition = 'fullscreen', flipHorizontal = false }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    if (!cameraId) return

    const startStream = async () => {
      try {
        let stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: cameraId } }
        }).catch(() => null)
        if (!stream && cameraId) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { ideal: cameraId } }
          }).catch(() => null)
        }
        if (stream && videoRef.current) {
          videoRef.current.srcObject = stream
          streamRef.current = stream
        }
      } catch (error) {
        console.error('Error accessing camera:', error)
      }
    }

    startStream()

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [cameraId])

  const getWebcamClass = () => {
    if (cameraOverrideEnabled && cameraOverridePosition) {
      switch (cameraOverridePosition) {
        case 'fullscreen': return 'webcam-video-fullscreen'
        case 'left-third': return 'webcam-video-left-third'
        case 'right-third': return 'webcam-video-right-third'
        case 'circle-top-left': return 'webcam-video-circle-top-left'
        case 'circle-top-right': return 'webcam-video-circle-top-right'
        case 'circle-bottom-left': return 'webcam-video-circle-bottom-left'
        case 'circle-bottom-right': return 'webcam-video-circle-bottom-right'
        default: return 'webcam-video-circle-bottom-right'
      }
    }
    if (layout === 'video') return 'webcam-video-fullscreen'
    if (layout === 'left-video') return 'webcam-video-right-panel'
    if (layout === 'right') return 'webcam-video-bottom-left'
    return 'webcam-video-bottom-right'
  }

  const filter = getVideoFilterFromProps({ videoBrightness, videoContrast, videoSaturation, videoShadows, videoMidtones, videoHighlights, videoShadowHue, videoMidHue, videoHighlightHue })

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className={`slide-webcam ${getWebcamClass()} ${isPlayMode ? 'play-mode' : ''}`}
      style={{ filter, transform: flipHorizontal ? 'scaleX(-1)' : 'none' }}
    />
  )
}

function Slide({ slide, backgroundColor = '#1a1a1a', textColor = '#ffffff', fontFamily = 'Inter', defaultTextSize = 4, h1Size = 10, h2Size = 3.5, h3Size = 2.5, h1FontFamily = '', h2FontFamily = '', h3FontFamily = '', defaultFontWeight = 700, h1Weight = 700, h2Weight = 700, h3Weight = 700, isPlayMode = false, visibleBulletIndex = null, visibleLineIndex = null, textDropShadow = false, shadowBlur = 4, shadowOffsetX = 2, shadowOffsetY = 2, shadowColor = '#000000', textInlineBackground = false, inlineBgColor = '#000000', inlineBgOpacity = 0.7, inlineBgPadding = 8, lineHeight = 1, bulletLineHeight = 1, bulletTextSize = 3, bulletGap = 0.5, contentBottomOffset = 12, contentEdgeOffset = 9, showBullets = true, onUpdate, webcamEnabled = false, selectedCameraId = '', webcamFlipHorizontal = false, videoBrightness = 1, videoContrast = 1, videoSaturation = 1, videoShadows = 1, videoMidtones = 1, videoHighlights = 1, videoShadowHue = 0, videoMidHue = 0, videoHighlightHue = 0, backgroundScaleAnimation = false, backgroundScaleTime = 10, backgroundScaleAmount = 20, textStyleMode = 'standard', fontPairingSerifFont = 'Playfair Display', textAnimation = 'none', textAnimationUnit = 'word', slideFormat = '16:9', cameraOverrideEnabled = false, cameraOverridePosition = 'fullscreen', isPreload = false, hideBackground = false }) {
  if (!slide) return null

  // Refs to track if contentEditable elements are being edited
  const contentRef = useRef(null)
  const subtitleRef = useRef(null)
  const isEditingContentRef = useRef(false)
  const isEditingSubtitleRef = useRef(false)
  // Font pairing context menu: store selection so we can wrap/unwrap on menu action
  const [fontPairingMenu, setFontPairingMenu] = useState(null)
  const fontPairingRangeRef = useRef(null)
  const fontPairingTargetRef = useRef(null) // { field: 'content'|'subtitle'|'bullet', bulletIndex?: number }

  // Text format toolbar: show on text selection in edit mode
  const [textFormatToolbar, setTextFormatToolbar] = useState(null) // { x, y, target: { field, bulletIndex? } }
  const textFormatRangeRef = useRef(null)
  const backgroundVideoRef = useRef(null)
  const backgroundVideoBlobUrlRef = useRef(null) // so we can revoke on cleanup
  // Resolved blob URL for cross-origin video (avoids COEP blocking Pexels/Pixabay)
  const [backgroundVideoSrc, setBackgroundVideoSrc] = useState(null)

  const layout = slide.layout === 'title' ? 'centered' : (slide.layout || 'default')
  const gradientStrength = slide.gradientStrength !== undefined ? slide.gradientStrength : 0.7
  const backgroundOpacity = slide.backgroundOpacity !== undefined ? slide.backgroundOpacity : 0.6
  const gradientFlipped = slide.gradientFlipped !== undefined ? slide.gradientFlipped : false
  const imageScale = slide.imageScale !== undefined ? slide.imageScale : 1.0
  const imagePositionX = slide.imagePositionX !== undefined ? slide.imagePositionX : 50
  const imagePositionY = slide.imagePositionY !== undefined ? slide.imagePositionY : 50

  // Fetch cross-origin video to blob URL so <video> loads same-origin (avoids COEP block)
  useEffect(() => {
    const url = slide.backgroundVideoUrl
    if (!url || layout === 'section') {
      if (backgroundVideoBlobUrlRef.current) {
        URL.revokeObjectURL(backgroundVideoBlobUrlRef.current)
        backgroundVideoBlobUrlRef.current = null
      }
      setBackgroundVideoSrc(null)
      return
    }
    const isExternal = url.startsWith('http://') || url.startsWith('https://')
    if (!isExternal) {
      setBackgroundVideoSrc(url)
      return
    }
    let cancelled = false
    if (backgroundVideoBlobUrlRef.current) {
      URL.revokeObjectURL(backgroundVideoBlobUrlRef.current)
      backgroundVideoBlobUrlRef.current = null
    }
    fetch(url, { mode: 'cors', credentials: 'omit' })
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText)
        return res.blob()
      })
      .then((blob) => {
        if (cancelled) return
        const blobUrl = URL.createObjectURL(blob)
        backgroundVideoBlobUrlRef.current = blobUrl
        setBackgroundVideoSrc(blobUrl)
      })
      .catch(() => {
        if (!cancelled) setBackgroundVideoSrc(null)
      })
    return () => {
      cancelled = true
      if (backgroundVideoBlobUrlRef.current) {
        URL.revokeObjectURL(backgroundVideoBlobUrlRef.current)
        backgroundVideoBlobUrlRef.current = null
      }
      setBackgroundVideoSrc(null)
    }
  }, [slide.backgroundVideoUrl, layout])

  // Ensure background video plays in both edit preview and present mode (skip play when isPreload so preload slides only buffer)
  useEffect(() => {
    if (!slide.backgroundVideoUrl || layout === 'section' || isPreload) return
    const el = backgroundVideoRef.current
    const play = () => {
      const video = backgroundVideoRef.current
      if (video) video.play().catch(() => {})
    }
    if (el) {
      if (el.readyState >= 2) play()
      else {
        el.addEventListener('loadeddata', play, { once: true })
        el.addEventListener('canplay', play, { once: true })
      }
    }
    const t = setTimeout(play, 100)
    return () => {
      clearTimeout(t)
      if (el) {
        el.removeEventListener('loadeddata', play)
        el.removeEventListener('canplay', play)
      }
    }
  }, [slide.backgroundVideoUrl, layout, backgroundVideoSrc, isPreload])

  // Convert hex color to RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 26, g: 26, b: 26 } // Default dark grey
  }

  const slideBgColor = (layout === 'video' && isPlayMode)
    ? 'transparent'
    : (slide.backgroundColorOverride && slide.backgroundColorOverrideValue)
      ? slide.backgroundColorOverrideValue
      : backgroundColor
  const rgb = hexToRgb(slideBgColor === 'transparent' ? backgroundColor : slideBgColor)

  // Calculate gradient opacity based on strength (0-1)
  const maxOpacity = gradientStrength
  const midOpacity = gradientStrength * 0.57 // ~0.4 when strength is 0.7

  // Parse bullet points (one per line); support both \n and <br> as separators so HTML renders correctly
  const getBulletPoints = () => {
    if (layout !== 'bulletpoints') return []
    // Normalize <br> to newlines so "A<br>B<br>C" and "A\nB\nC" both yield multiple bullets
    const normalized = (slide.content || '').replace(/<br\s*\/?>/gi, '\n')
    const raw = normalized
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.replace(/^[-•*]\s*/, '')) // Remove bullet markers if present
      .filter(line => {
        // Strip HTML tags to get plain text; drop bullets that have no visible text
        const plain = line.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim()
        return plain.length > 0
      })
    // Keep only first occurrence of each line so duplicated text from layout/slide switching never appears
    const seen = new Set()
    return raw.filter(line => {
      if (seen.has(line)) return false
      seen.add(line)
      return true
    })
  }

  // Split content into lines (for "show one line at a time" in play mode).
  // Normalize contentEditable line breaks: <div>, <p>, <br> become newlines so each line is one "reveal" step.
  const getContentLines = (content) => {
    if (!content) return ['']
    const normalized = (content + '')
      .replace(/<div[^>]*>\s*/gi, '\n')
      .replace(/<\/div>\s*/gi, '\n')
      .replace(/<p[^>]*>\s*/gi, '\n')
      .replace(/<\/p>\s*/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
    const lines = normalized.split('\n')
    return lines.length ? lines : ['']
  }

  // Strip trailing line breaks (no text after them) so they don't show in edit or present mode
  const stripTrailingLineBreaks = (s) => {
    if (!s || typeof s !== 'string') return s
    return s.replace(/(<br\s*\/?>\s*)+$/gi, '').replace(/\n+$/, '')
  }

  // Convert line breaks to HTML breaks for display and apply text highlighting
  const formatContentForDisplay = (content) => {
    if (!content) return ''
    
    // First, convert literal <BR> or <br> text (case insensitive) to actual <br> tags
    // This handles cases where users type <BR> or <br> as text
    content = content.replace(/<BR\s*\/?>/gi, '<br>')
    
    // Normalize contentEditable line breaks: Chrome etc. use <div> for Enter, use <br> so editor and present mode match
    content = content.replace(/<div[^>]*>\s*/gi, '<br>').replace(/<\/div>\s*/gi, '')
    
    // Check if content contains HTML tags (including mark tags)
    const hasHtmlTags = content.includes('<') && content.includes('>')
    
    // Apply or remove highlight styling on <mark> tags based on setting
    if (textInlineBackground) {
      try {
        const rgb = hexToRgb(inlineBgColor)
        const highlightColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${inlineBgOpacity})`
        // Process mark tags and add style attribute
        // Match <mark> or <mark ...> with any attributes
        content = content.replace(/<mark(\s[^>]*)?>/gi, (match, attrs = '') => {
          // Check if style already exists
          if (attrs && attrs.includes('style=')) {
            // Update existing style - replace the entire style attribute
            return match.replace(/style\s*=\s*["'][^"']*["']/i, `style="background-color: ${highlightColor}; padding: ${inlineBgPadding}px; border-radius: 4px;"`)
          } else {
            // Add style attribute - ensure proper spacing
            const spacing = attrs.trim() ? ' ' : ''
            return `<mark style="background-color: ${highlightColor}; padding: ${inlineBgPadding}px; border-radius: 4px;"${spacing}${attrs}>`
          }
        })
      } catch (e) {
        console.error('Error applying highlight styling:', e)
      }
    } else {
      // When text highlight is disabled: strip background from <mark> so no box appears
      content = content.replace(/<mark(\s[^>]*)?>/gi, (match, attrs = '') => {
        const noHighlightStyle = 'style="background: none; padding: 0; border-radius: 0;"'
        if (attrs && attrs.includes('style=')) {
          return match.replace(/style\s*=\s*["'][^"']*["']/i, noHighlightStyle)
        }
        const spacing = attrs.trim() ? ' ' : ''
        return `<mark ${noHighlightStyle}${spacing}${attrs}>`
      })
    }
    
    // If content already contains HTML tags (from formatting or contentEditable), 
    // convert \n to <br> within the HTML and preserve all HTML tags
    if (hasHtmlTags) {
      content = content.replace(/\n/g, '<br>')
      return stripTrailingLineBreaks(content)
    }
    
    // For plain text content, we need to escape HTML but preserve <br> tags
    // Use a placeholder to protect <br> tags during escaping
    const brPlaceholder = '___BR_TAG_PLACEHOLDER___'
    content = content
      .replace(/<br\s*\/?>/gi, brPlaceholder)  // Protect <br> tags
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, brPlaceholder)  // Convert newlines to placeholder
      .replace(new RegExp(brPlaceholder, 'g'), '<br>')  // Restore <br> tags
    
    return stripTrailingLineBreaks(content)
  }

  // Check if subtitle has actual text content (strips HTML tags)
  const hasSubtitleContent = () => {
    if (!slide.subtitle) return false
    // Strip HTML tags and check if there's actual text
    const textOnly = slide.subtitle.replace(/<[^>]*>/g, '').trim()
    return textOnly.length > 0
  }

  // Get plain text words from HTML (for words-fade-up animation)
  const getWordsFromContent = (html) => {
    if (!html || typeof html !== 'string') return []
    const text = html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
    return text ? text.split(' ').filter(Boolean) : []
  }

  // Get words with serif flag, line-break markers, and block tag (h1/h2/h3) for present mode heading styling
  const getWordsWithFormatting = (html) => {
    if (!html || typeof html !== 'string') return []
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const result = []
      const walk = (node, blockTag = null) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = (node.textContent || '').replace(/\s+/g, ' ').trim()
          if (!text) return
          const serif = !!(node.parentElement?.closest?.('.font-pairing-serif'))
          text.split(' ').filter(Boolean).forEach((word) => result.push({ word, serif, blockTag }))
          return
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tag = node.tagName ? node.tagName.toLowerCase() : ''
          if (tag === 'br' || tag === 'div') {
            result.push({ lineBreak: true, blockTag })
            if (tag === 'div') node.childNodes.forEach((n) => walk(n, blockTag))
            return
          }
          const childBlockTag = (tag === 'h1' || tag === 'h2' || tag === 'h3') ? tag : blockTag
          node.childNodes.forEach((n) => walk(n, childBlockTag))
        }
      }
      walk(doc.body)
      return result
    } catch (e) {
      return getWordsFromContent(html).map((word) => ({ word, serif: false, blockTag: null }))
    }
  }

  // Get sentences (with serif flag, line breaks, blockTag) for sentence-level animation
  const getSentencesWithFormatting = (html) => {
    const words = getWordsWithFormatting(html)
    const result = []
    let sentence = []
    for (const item of words) {
      if (item.lineBreak) {
        if (sentence.length) {
          result.push({ text: sentence.map((s) => s.word).join(' ') + ' ', serif: sentence[0].serif, blockTag: sentence[0].blockTag })
          sentence = []
        }
        result.push({ lineBreak: true, blockTag: item.blockTag })
        continue
      }
      sentence.push(item)
      if (/[.!?]$/.test(item.word)) {
        result.push({ text: sentence.map((s) => s.word).join(' ') + ' ', serif: sentence[0].serif, blockTag: sentence[0].blockTag })
        sentence = []
      }
    }
    if (sentence.length) {
      result.push({ text: sentence.map((s) => s.word).join(' ') + ' ', serif: sentence[0].serif, blockTag: sentence[0].blockTag })
    }
    return result
  }

  // Chunks = words or sentences depending on textAnimationUnit (for staggered text animations)
  const getChunksWithFormatting = (html, unit) => {
    if (unit === 'sentence') return getSentencesWithFormatting(html)
    return getWordsWithFormatting(html)
  }

  // Render chunked content with h1/h2/h3 wrappers so present-mode text animation preserves heading styling
  const renderChunksWithHeadings = (chunks, chunkDelay, offset = 0) => {
    const nodes = []
    let currentTag = null
    let group = []
    let chunkIndex = offset
    const flush = () => {
      if (group.length === 0) return
      const content = group.map((item, j) => (
        <span key={nodes.length + j} className={`text-animation-word ${item.serif ? 'font-pairing-serif' : ''}`} style={{ animationDelay: `${(chunkIndex - group.length + j) * chunkDelay}s` }}>
          {item.word != null ? item.word + ' ' : item.text}
        </span>
      ))
      if (currentTag === 'h1' || currentTag === 'h2' || currentTag === 'h3') {
        nodes.push(React.createElement(currentTag, { key: `block-${nodes.length}` }, content))
      } else {
        nodes.push(React.createElement(React.Fragment, { key: `block-${nodes.length}` }, ...content))
      }
      group = []
    }
    chunks.forEach((item, i) => {
      if (item.lineBreak) {
        flush()
        currentTag = item.blockTag ?? null
        nodes.push(<br key={`br-${i}`} />)
        chunkIndex++
        return
      }
      if (item.blockTag !== currentTag) {
        flush()
        currentTag = item.blockTag ?? null
      }
      group.push(item)
      chunkIndex++
    })
    flush()
    return nodes
  }

  const handleContentChange = (e) => {
    if (!onUpdate || isPlayMode) return
    isEditingContentRef.current = false
    const raw = e.target.innerHTML || e.target.textContent || ''
    const newContent = normalizeLineBreaksForStorage(raw)
    onUpdate({ content: newContent })
  }

  const handleContentFocus = (e) => {
    isEditingContentRef.current = true
  }

  const handleSubtitleChange = (e) => {
    if (!onUpdate || isPlayMode) return
    isEditingSubtitleRef.current = false
    const raw = e.target.innerHTML
    const newSubtitle = normalizeLineBreaksForStorage(raw)
    onUpdate({ subtitle: newSubtitle })
  }

  const handleSubtitleFocus = (e) => {
    isEditingSubtitleRef.current = true
  }

  // Both Enter and Shift+Enter insert <br> so edit mode and presentation show identical line breaks
  const handleLineBreakKey = (e, focusRef) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      document.execCommand('insertLineBreak')
      const target = e.target
      setTimeout(() => {
        const el = focusRef?.current ?? target
        if (el) el.focus()
      }, 0)
    }
  }

  // Normalize content on save: convert <div>/<p> blocks to <br> so presentation matches edit mode.
  // Only add <br> between blocks, not at the start, to avoid extra line breaks when applying H1/H2/H3.
  const normalizeLineBreaksForStorage = (html) => {
    if (!html || typeof html !== 'string') return html
    return html
      .replace(/<\/p>\s*<p[^>]*>/gi, '<br>')
      .replace(/<\/div>\s*<div[^>]*>/gi, '<br>')
      .replace(/<\/p>\s*<div[^>]*>/gi, '<br>')
      .replace(/<\/div>\s*<p[^>]*>/gi, '<br>')
      .replace(/<p[^>]*>\s*/gi, '')
      .replace(/<\/p>\s*/gi, '')
      .replace(/<div[^>]*>\s*/gi, '')
      .replace(/<\/div>\s*/gi, '')
  }

  // Font pairing: only active in edit mode when textStyleMode is fontPairing
  const isFontPairingEditable = !isPlayMode && onUpdate && textStyleMode === 'fontPairing'

  const handleFontPairingContextMenu = (e, field, bulletIndex = null) => {
    if (!isFontPairingEditable) return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
    e.preventDefault()
    e.stopPropagation()
    const range = sel.getRangeAt(0).cloneRange()
    fontPairingRangeRef.current = range
    fontPairingTargetRef.current = { field, bulletIndex }
    setFontPairingMenu({ x: e.clientX, y: e.clientY })
  }

  const closeFontPairingMenu = () => {
    setFontPairingMenu(null)
    fontPairingRangeRef.current = null
    fontPairingTargetRef.current = null
  }

  const applySerifToSelection = () => {
    const range = fontPairingRangeRef.current
    const target = fontPairingTargetRef.current
    if (!range || !target || !onUpdate) return
    try {
      const span = document.createElement('span')
      span.className = 'font-pairing-serif'
      range.surroundContents(span)
      syncFontPairingContentToState(target)
    } catch (err) {
      // surroundContents can fail if selection spans block boundaries; ignore
    }
    closeFontPairingMenu()
  }

  const removeSerifFromSelection = () => {
    const range = fontPairingRangeRef.current
    const target = fontPairingTargetRef.current
    if (!range || !target || !onUpdate) return
    try {
      const container = range.commonAncestorContainer
      const span = container.nodeType === Node.TEXT_NODE ? container.parentElement?.closest('.font-pairing-serif') : container.closest?.('.font-pairing-serif')
      if (span && span.classList.contains('font-pairing-serif')) {
        const parent = span.parentNode
        while (span.firstChild) parent.insertBefore(span.firstChild, span)
        parent.removeChild(span)
        syncFontPairingContentToState(target)
      }
    } catch (err) {}
    closeFontPairingMenu()
  }

  const syncFontPairingContentToState = (target) => {
    if (!target || !onUpdate) return
    if (target.field === 'content') {
      if (contentRef.current) onUpdate({ content: contentRef.current.innerHTML })
    } else if (target.field === 'subtitle') {
      if (subtitleRef.current) onUpdate({ subtitle: subtitleRef.current.innerHTML })
    } else if (target.field === 'bullet' && typeof target.bulletIndex === 'number') {
      const bullets = (slide.content || '').split('\n').map(line => line.trim()).filter(Boolean).map(line => line.replace(/^[-•*]\s*/, ''))
      const bulletEl = slideRef.current?.querySelector(`.slide-bullet:nth-child(${target.bulletIndex + 1}) .bullet-text`)
      if (bulletEl && bullets[target.bulletIndex] !== undefined) {
        bullets[target.bulletIndex] = bulletEl.innerHTML
        onUpdate({ content: bullets.join('\n') })
      }
    }
  }

  useEffect(() => {
    if (!fontPairingMenu) return
    const handleClickOutside = (e) => {
      if (e.target?.closest?.('.slide-font-pairing-menu')) return
      closeFontPairingMenu()
    }
    const handleEscape = (e) => {
      if (e.key === 'Escape') closeFontPairingMenu()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [fontPairingMenu])

  // Text format toolbar: detect selection inside slide text and show toolbar
  const isEditableForToolbar = !isPlayMode && onUpdate
  useEffect(() => {
    if (!isEditableForToolbar || !slideRef.current) return
    const checkSelection = () => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setTextFormatToolbar(null)
        return
      }
      const range = sel.getRangeAt(0)
      const el = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentElement
        : range.commonAncestorContainer
      if (!el || !slideRef.current.contains(el)) {
        setTextFormatToolbar(null)
        return
      }
      const textEl = el.closest('.slide-text, .slide-subtitle, .bullet-text, .slide-section-name')
      if (!textEl) {
        setTextFormatToolbar(null)
        return
      }
      // Resolve target before rect fallback (fallback uses target to get container)
      let target = null
      if (contentRef.current && (textEl === contentRef.current || contentRef.current.contains(textEl))) {
        target = { field: 'content' }
      } else if (subtitleRef.current && (textEl === subtitleRef.current || subtitleRef.current.contains(textEl))) {
        target = { field: 'subtitle' }
      } else if (textEl.classList.contains('bullet-text')) {
        const bullet = textEl.closest('.slide-bullet')
        const list = bullet?.parentElement
        const index = list ? Array.from(list.querySelectorAll('.slide-bullet')).indexOf(bullet) : -1
        if (index >= 0) target = { field: 'bullet', bulletIndex: index }
      } else if (textEl.classList.contains('slide-section-name')) {
        target = { field: 'content' }
      }
      if (!target) {
        setTextFormatToolbar(null)
        return
      }
      let rect = range.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) {
        const fallbackEl = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
          ? range.commonAncestorContainer.parentElement
          : range.commonAncestorContainer
        if (fallbackEl && fallbackEl.getBoundingClientRect) {
          rect = fallbackEl.getBoundingClientRect()
        }
        if (rect.width === 0 && rect.height === 0) {
          const container = target.field === 'content' ? contentRef.current : target.field === 'subtitle' ? subtitleRef.current : null
          if (container && container.getBoundingClientRect) rect = container.getBoundingClientRect()
        }
        if (rect.width === 0 && rect.height === 0) {
          setTextFormatToolbar(null)
          return
        }
      }
      // Check if selection is inside .font-pairing-serif (for Serif button toggle state)
      const startEl = range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement
        : range.startContainer
      const serifActive = !!(startEl?.closest?.('.font-pairing-serif'))
      const boldActive = document.queryCommandState('bold')
      const italicActive = document.queryCommandState('italic')
      const underlineActive = document.queryCommandState('underline')
      const strikethroughActive = document.queryCommandState('strikeThrough')
      const backgroundActive = !!(startEl?.closest?.('mark'))
      // Explicit text color: walk up from selection start and use first inline style.color
      let textColorActive = null
      let colorEl = startEl
      while (colorEl && colorEl.nodeType === Node.ELEMENT_NODE) {
        if (colorEl.style?.color) {
          textColorActive = colorEl.style.color
          break
        }
        colorEl = colorEl.parentElement
      }
      // Block-level element for heading state (H1/H2/H3 or default), within the target container
      const targetContainer = target.field === 'content' ? contentRef.current : target.field === 'subtitle' ? subtitleRef.current : null
      let headingBlock = null
      if (targetContainer) {
        let blockEl = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : range.startContainer
        while (blockEl && targetContainer.contains(blockEl)) {
          if (blockEl.nodeType === Node.ELEMENT_NODE && ['H1', 'H2', 'H3', 'P', 'DIV'].includes(blockEl.tagName)) {
            headingBlock = blockEl
            break
          }
          blockEl = blockEl.parentElement
        }
      }
      const headingActive = headingBlock && ['H1', 'H2', 'H3'].includes(headingBlock.tagName) ? headingBlock.tagName.toLowerCase() : null
      textFormatRangeRef.current = range.cloneRange()
      setTextFormatToolbar({
        x: rect.left + rect.width / 2,
        y: rect.top,
        target,
        serifActive,
        boldActive,
        italicActive,
        underlineActive,
        strikethroughActive,
        backgroundActive,
        headingActive,
        textColorActive
      })
    }
    const scheduleCheck = () => setTimeout(checkSelection, 10)
    const handleMouseUp = scheduleCheck
    const handleKeyUp = (e) => {
      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) scheduleCheck()
    }
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('keyup', handleKeyUp)
    document.addEventListener('selectionchange', scheduleCheck)
    return () => {
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('keyup', handleKeyUp)
      document.removeEventListener('selectionchange', scheduleCheck)
    }
  }, [isEditableForToolbar])

  // Sync content from target element to slide state (after applying a format)
  const syncContentFromTarget = useCallback((target) => {
    if (!target || !onUpdate) return
    if (target.field === 'content') {
      if (contentRef.current) onUpdate({ content: normalizeLineBreaksForStorage(contentRef.current.innerHTML) })
    } else if (target.field === 'subtitle') {
      if (subtitleRef.current) onUpdate({ subtitle: normalizeLineBreaksForStorage(subtitleRef.current.innerHTML) })
    } else if (target.field === 'bullet' && typeof target.bulletIndex === 'number' && slideRef.current) {
      const list = slideRef.current.querySelector('.slide-bullets')
      if (!list) return
      const bullets = Array.from(list.querySelectorAll('.slide-bullet')).map(
        (b) => normalizeLineBreaksForStorage(b.querySelector('.bullet-text')?.innerHTML ?? '')
      )
      onUpdate({ content: bullets.join('\n') })
    }
  }, [onUpdate])

  const closeTextFormatToolbar = useCallback(() => {
    setTextFormatToolbar(null)
    textFormatRangeRef.current = null
  }, [])

  const applyFormat = useCallback((applyFn) => {
    const state = textFormatToolbar
    if (!state?.target) return
    const range = textFormatRangeRef.current
    if (!range) return
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
    try {
      applyFn()
    } catch (e) {
      // ignore
    }
    syncContentFromTarget(state.target)
    closeTextFormatToolbar()
  }, [textFormatToolbar, syncContentFromTarget, closeTextFormatToolbar])

  const applyBold = useCallback(() => applyFormat(() => document.execCommand('bold', false, null)), [applyFormat])
  const applyItalic = useCallback(() => applyFormat(() => document.execCommand('italic', false, null)), [applyFormat])
  const applyUnderline = useCallback(() => applyFormat(() => document.execCommand('underline', false, null)), [applyFormat])
  const applyStrikethrough = useCallback(() => applyFormat(() => document.execCommand('strikeThrough', false, null)), [applyFormat])
  const applyBackground = useCallback(() => {
    const state = textFormatToolbar
    if (!state?.target) return
    const range = textFormatRangeRef.current
    if (!range) return
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
    try {
      const container = range.commonAncestorContainer
      const startEl = container.nodeType === Node.TEXT_NODE ? container.parentElement : container
      const markEl = startEl?.closest?.('mark')
      if (markEl?.tagName === 'MARK') {
        const parent = markEl.parentNode
        while (markEl.firstChild) parent.insertBefore(markEl.firstChild, markEl)
        parent.removeChild(markEl)
      } else {
        const mark = document.createElement('mark')
        // Always set a visible highlight color so the toolbar action always shows feedback
        const highlightRgb = textInlineBackground ? hexToRgb(inlineBgColor) : { r: 250, g: 204, b: 21 }
        const opacity = textInlineBackground ? inlineBgOpacity : 0.4
        mark.style.backgroundColor = `rgba(${highlightRgb.r}, ${highlightRgb.g}, ${highlightRgb.b}, ${opacity})`
        mark.style.padding = `${inlineBgPadding}px`
        mark.style.borderRadius = '4px'
        try {
          range.surroundContents(mark)
        } catch (e) {
          const fragment = range.extractContents()
          mark.appendChild(fragment)
          range.insertNode(mark)
        }
      }
    } catch (e) {
      // ignore
    }
    syncContentFromTarget(state.target)
    closeTextFormatToolbar()
  }, [textFormatToolbar, syncContentFromTarget, closeTextFormatToolbar, textInlineBackground, inlineBgColor, inlineBgOpacity, inlineBgPadding])
  const getBlockElement = useCallback((range, container) => {
    if (!container) return null
    let node = range.startContainer
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
    while (node && container.contains(node)) {
      if (node === container) return null // never treat the contentEditable root as the block
      if (node.nodeType === Node.ELEMENT_NODE && ['H1', 'H2', 'H3', 'P', 'DIV'].includes(node.tagName)) return node
      node = node.parentElement
    }
    return null
  }, [])
  const applyHeading = useCallback((tagName) => {
    const state = textFormatToolbar
    if (!state?.target) return
    const range = textFormatRangeRef.current
    if (!range) return
    const container = state.target.field === 'content' ? contentRef.current : state.target.field === 'subtitle' ? subtitleRef.current : null
    if (!container) return
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
    try {
      const block = getBlockElement(range, container)
      const currentTag = block ? block.tagName.toLowerCase() : null
      const isTogglingOff = block && currentTag === tagName
      const selectionSpansFullBlock = block && range.toString().trim() === (block.textContent || '').trim()
      if (isTogglingOff && selectionSpansFullBlock) {
        const p = document.createElement('p')
        while (block.firstChild) p.appendChild(block.firstChild)
        if (block.parentNode) block.parentNode.replaceChild(p, block)
      } else if (selectionSpansFullBlock) {
        // Replace block with heading to avoid extra line break from <p><h1>...</h1></p>
        const newEl = document.createElement(tagName)
        while (block.firstChild) newEl.appendChild(block.firstChild)
        if (block.parentNode) block.parentNode.replaceChild(newEl, block)
      } else {
        const newEl = document.createElement(isTogglingOff ? 'p' : tagName)
        try {
          range.surroundContents(newEl)
        } catch (e) {
          const fragment = range.extractContents()
          newEl.appendChild(fragment)
          range.insertNode(newEl)
        }
      }
    } catch (e) {
      // ignore
    }
    syncContentFromTarget(state.target)
    closeTextFormatToolbar()
  }, [textFormatToolbar, getBlockElement, syncContentFromTarget, closeTextFormatToolbar])
  const applyFontPairing = useCallback(() => {
    const state = textFormatToolbar
    if (!state?.target) return
    const range = textFormatRangeRef.current
    if (!range) return
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
    try {
      const container = state.target.field === 'content' ? contentRef.current : state.target.field === 'subtitle' ? subtitleRef.current : null
      if (!container) return
      const allSerif = container.querySelectorAll('.font-pairing-serif')
      const serifSpans = Array.from(allSerif).filter((el) => {
        try {
          return range.intersectsNode(el)
        } catch (e) {
          return false
        }
      })
      if (serifSpans.length > 0) {
        const depth = (el) => { let d = 0; let p = el; while (p && p !== container) { d++; p = p.parentElement; } return d }
        serifSpans.sort((a, b) => depth(b) - depth(a))
        serifSpans.forEach((span) => {
          const parent = span.parentNode
          if (parent) {
            while (span.firstChild) parent.insertBefore(span.firstChild, span)
            parent.removeChild(span)
          }
        })
      } else {
        const serifSpan = document.createElement('span')
        serifSpan.className = 'font-pairing-serif'
        try {
          range.surroundContents(serifSpan)
        } catch (e) {
          const fragment = range.extractContents()
          serifSpan.appendChild(fragment)
          range.insertNode(serifSpan)
        }
      }
    } catch (e) {
      // ignore
    }
    syncContentFromTarget(state.target)
    closeTextFormatToolbar()
  }, [textFormatToolbar, syncContentFromTarget, closeTextFormatToolbar])

  // Unwrap span nodes that only have style.color (used when clearing text color)
  const unwrapColorSpans = useCallback((node) => {
    if (!node) return
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SPAN') {
      const style = node.getAttribute('style')
      if (style && /^\s*color\s*:/.test(style.trim()) && !style.replace(/\s*color\s*:[^;]+;?/gi, '').trim()) {
        const parent = node.parentNode
        if (parent) {
          while (node.firstChild) parent.insertBefore(node.firstChild, node)
          parent.removeChild(node)
          unwrapColorSpans(parent) // reprocess so nested color spans are also unwrapped
        }
        return
      }
    }
    const children = Array.from(node.childNodes)
    children.forEach((child) => unwrapColorSpans(child))
  }, [])

  const applyTextColor = useCallback((color) => {
    const state = textFormatToolbar
    if (!state?.target) return
    const range = textFormatRangeRef.current
    if (!range) return
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
    try {
      if (color == null || color === '') {
        const fragment = range.extractContents()
        unwrapColorSpans(fragment)
        range.insertNode(fragment)
      } else {
        const span = document.createElement('span')
        span.style.color = color
        try {
          range.surroundContents(span)
        } catch (e) {
          const fragment = range.extractContents()
          span.appendChild(fragment)
          range.insertNode(span)
        }
      }
    } catch (e) {
      // ignore
    }
    syncContentFromTarget(state.target)
    closeTextFormatToolbar()
  }, [textFormatToolbar, syncContentFromTarget, closeTextFormatToolbar, unwrapColorSpans])

  // Remove all inline/block formatting from selection and restore layout default
  const applyClearFormatting = useCallback(() => {
    const state = textFormatToolbar
    if (!state?.target) return
    let range = textFormatRangeRef.current
    if (!range) return
    const targetEl = state.target.field === 'content' ? contentRef.current : state.target.field === 'subtitle' ? subtitleRef.current : null
    if (!targetEl) return
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
    try {
      // If selection is collapsed, expand to entire target so "reset" clears the whole field
      if (range.collapsed) {
        range = document.createRange()
        range.selectNodeContents(targetEl)
        sel.removeAllRanges()
        sel.addRange(range)
      }
      const fragment = range.extractContents()
      const isFormattingTag = (el) => {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return false
        const tag = el.tagName.toLowerCase()
        if (['b', 'strong', 'i', 'em', 'u', 'mark'].includes(tag)) return true
        if (tag === 'span') {
          if (el.classList?.contains('font-pairing-serif')) return true
          const style = el.getAttribute('style')
          if (style && /^\s*color\s*:/.test(style.trim()) && !style.replace(/\s*color\s*:[^;]+;?/gi, '').trim()) return true
        }
        return false
      }
      const depth = (node, root) => {
        let d = 0
        let n = node
        while (n && n !== root) {
          d++
          n = n.parentNode
        }
        return d
      }
      const toProcess = []
      const collect = (node) => {
        if (node.nodeType === Node.TEXT_NODE) return
        if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
          Array.from(node.childNodes).forEach(collect)
          return
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return
        Array.from(node.childNodes).forEach(collect)
        const tag = node.tagName ? node.tagName.toLowerCase() : ''
        if (isFormattingTag(node) || ['h1', 'h2', 'h3'].includes(tag)) {
          toProcess.push(node)
        }
      }
      collect(fragment)
      toProcess.sort((a, b) => depth(b, fragment) - depth(a, fragment))
      const unwrap = (el) => {
        const parent = el.parentNode
        if (!parent) return
        while (el.firstChild) parent.insertBefore(el.firstChild, el)
        parent.removeChild(el)
      }
      toProcess.forEach((node) => {
        if (!node.parentNode) return
        const tag = node.tagName ? node.tagName.toLowerCase() : ''
        if (['h1', 'h2', 'h3'].includes(tag)) {
          const p = document.createElement('p')
          while (node.firstChild) p.appendChild(node.firstChild)
          if (node.parentNode) node.parentNode.replaceChild(p, node)
        } else if (isFormattingTag(node)) {
          unwrap(node)
        }
      })
      range.insertNode(fragment)
    } catch (e) {
      // ignore
    }
    syncContentFromTarget(state.target)
    closeTextFormatToolbar()
  }, [textFormatToolbar, syncContentFromTarget, closeTextFormatToolbar])

  // Update contentEditable elements only when not being edited
  useEffect(() => {
    // Don't update if currently being edited or if element is focused
    if (!isEditingContentRef.current && contentRef.current && slide.content !== undefined) {
      // Check if element is currently focused - if so, don't update
      if (document.activeElement === contentRef.current) {
        return
      }
      
      // Check if there's a selection range in the element
      const selection = window.getSelection()
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        if (contentRef.current.contains(range.commonAncestorContainer)) {
          return
        }
      }
      
      const formattedContent = formatContentForDisplay(slide.content)
      // Only update if content actually changed
      const currentInnerHTML = contentRef.current.innerHTML || ''
      if (currentInnerHTML !== formattedContent) {
        // Save selection if any
        const selection = window.getSelection()
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null
        
        contentRef.current.innerHTML = formattedContent
        
        // Try to restore selection if it existed
        if (range && contentRef.current.contains(range.commonAncestorContainer)) {
          try {
            selection.removeAllRanges()
            selection.addRange(range)
          } catch (e) {
            // Ignore selection errors
          }
        }
      }
    }
  }, [slide.content, textInlineBackground, inlineBgColor, inlineBgOpacity, inlineBgPadding])
  
  // Initialize content when element is first created, when slide changes, or when layout changes.
  // When slide.id or layout changes, always sync content so text is never lost (e.g. when switching from Centered to Left Aligned).
  // Clear editing refs first so we don't skip due to stale "editing" state.
  useEffect(() => {
    if (!contentRef.current) return
    // On slide or layout change, clear editing state so we always show the current slide's content
    isEditingContentRef.current = false
    isEditingSubtitleRef.current = false
    const formattedContent = formatContentForDisplay(slide.content || '')
    if (formattedContent) {
      contentRef.current.innerHTML = formattedContent
    } else {
      contentRef.current.innerHTML = ''
    }
    if (subtitleRef.current) {
      subtitleRef.current.innerHTML = formatContentForDisplay(slide.subtitle || '')
    }
  }, [slide.id, layout, textInlineBackground, inlineBgColor, inlineBgOpacity, inlineBgPadding, textStyleMode, fontPairingSerifFont]) // Re-initialize when slide or layout changes or highlight settings change

  useEffect(() => {
    if (!isEditingSubtitleRef.current && subtitleRef.current && slide.subtitle !== undefined) {
      const formattedSubtitle = formatContentForDisplay(slide.subtitle)
      if (subtitleRef.current.innerHTML !== formattedSubtitle) {
        subtitleRef.current.innerHTML = formattedSubtitle
      }
    }
  }, [slide.subtitle, textInlineBackground, inlineBgColor, inlineBgOpacity, inlineBgPadding])

  // Auto-resize textarea for non-bulletpoint, non-section layouts (centered, default, right)
  // This must be outside renderContent to avoid conditional hook calls
  useEffect(() => {
    if (contentRef.current && !isPlayMode && layout !== 'bulletpoints' && layout !== 'section' && contentRef.current.tagName === 'TEXTAREA') {
      const getPlainText = (content) => {
        if (!content) return ''
        return content
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<BR\s*\/?>/gi, '\n')
          .replace(/&nbsp;/g, ' ')
          .replace(/<[^>]*>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
      }
      const plainText = getPlainText(slide.content || '')
      // Only resize if it's a textarea
      if (contentRef.current.tagName === 'TEXTAREA') {
        contentRef.current.style.height = 'auto'
        contentRef.current.style.height = contentRef.current.scrollHeight + 'px'
      }
    }
  }, [slide.content, isPlayMode, layout])

  const handleBulletChange = (index, e) => {
    if (!onUpdate || isPlayMode) return
    const bullets = getBulletPoints()
    bullets[index] = e.target.innerHTML
    const newContent = bullets.join('\n')
    onUpdate({ content: newContent })
  }

  const renderContent = () => {
    const textHeadingLevel = slide.textHeadingLevel || null
    const subtitleHeadingLevel = slide.subtitleHeadingLevel || null
    const isEditable = !isPlayMode && onUpdate
    
    // Get heading size and font based on heading level
    const getHeadingSize = (level) => {
      if (level === 'h1') return h1Size
      if (level === 'h2') return h2Size
      if (level === 'h3') return h3Size
      return null
    }
    
    const getHeadingFont = (level) => {
      if (level === 'h1') return h1FontFamily || fontFamily
      if (level === 'h2') return h2FontFamily || fontFamily
      if (level === 'h3') return h3FontFamily || fontFamily
      return fontFamily
    }
    
    // Base text style (explicit color so slides always use current text color)
    const getHeadingWeight = (level) => {
      if (level === 'h1') return h1Weight
      if (level === 'h2') return h2Weight
      if (level === 'h3') return h3Weight
      return defaultFontWeight
    }
    const baseTextStyle = {
      color: textColor,
      textShadow: textDropShadow 
        ? `${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px ${shadowColor}` 
        : undefined,
      fontSize: textHeadingLevel ? `${getHeadingSize(textHeadingLevel)}rem` : undefined,
      fontFamily: textHeadingLevel ? `"${getHeadingFont(textHeadingLevel)}", sans-serif` : `"${fontFamily}", sans-serif`,
      fontWeight: textHeadingLevel ? getHeadingWeight(textHeadingLevel) : defaultFontWeight,
      lineHeight: lineHeight,
      pointerEvents: isEditable ? 'auto' : undefined
    }
    
    // Apply dynamic sizing class if needed
    const dynamicClass = textStyleMode === 'dynamic' ? 'text-dynamic-sizing' : ''
    
    const textStyle = baseTextStyle
    
    const subtitleStyle = {
      ...textStyle,
      fontSize: subtitleHeadingLevel ? `${getHeadingSize(subtitleHeadingLevel)}rem` : undefined,
      fontFamily: subtitleHeadingLevel ? `"${getHeadingFont(subtitleHeadingLevel)}", sans-serif` : undefined,
      pointerEvents: isEditable ? 'auto' : undefined
    }

    const useChunkedText = isPlayMode && textAnimation && textAnimation !== 'none'
    const chunkDelay = textAnimationUnit === 'word' ? 0.07 : 0.2

    if (layout === 'bulletpoints') {
      // Edit mode: single text field (one line per bullet)
      if (isEditable) {
        return (
          <div key={`${slide.id}-bulletpoints-edit`} className="slide-bullets slide-bullets-single-field" style={{ ...textStyle, '--slide-bullet-gap': `${bulletGap}rem` }}>
            <textarea
              ref={contentRef}
              className="slide-bullets-textarea"
              value={(() => {
                const c = slide.content || ''
                return c
                  .replace(/<br\s*\/?>/gi, '\n')
                  .replace(/<[^>]*>/g, '')
                  .replace(/&nbsp;/gi, ' ')
              })()}
              onChange={(e) => onUpdate && onUpdate({ content: e.target.value })}
              onFocus={handleContentFocus}
              placeholder="One bullet per line..."
              style={{ lineHeight: bulletLineHeight, resize: 'none' }}
              spellCheck={true}
            />
          </div>
        )
      }
      // View / play mode: list of bullets (with optional showBullets, animations)
      const bullets = getBulletPoints()
      const bulletChunkOffsets = useChunkedText ? bullets.reduce((acc, b, i) => { acc.push(acc[i] + getChunksWithFormatting(b, textAnimationUnit).length); return acc }, [0]) : []
      const getBulletStyle = (index) => {
        const base = { pointerEvents: undefined, lineHeight: bulletLineHeight }
        if (!isPlayMode || !textAnimation || textAnimation === 'none') return base
        if (textAnimation === 'typewriter') {
          return { ...base, animationDelay: `${0.3 + index * 1.4}s` }
        }
        return { ...base, animationDelay: `${index * 0.2}s` }
      }
      return (
        <div key={`${slide.id}-bulletpoints`} className={`slide-bullets${!showBullets ? ' bullets-hidden' : ''}`} style={{ ...textStyle, '--slide-bullet-gap': `${bulletGap}rem` }}>
          {bullets.map((bullet, index) => (
            <div
              key={index}
              className={`slide-bullet ${isPlayMode && visibleBulletIndex !== null ? (index <= visibleBulletIndex ? 'visible' : 'hidden') : 'visible'}`}
              style={{ lineHeight: bulletLineHeight }}
            >
              {useChunkedText ? (
                <span className="bullet-text slide-text-words" style={{ lineHeight: bulletLineHeight }}>
                  {getChunksWithFormatting(bullet, textAnimationUnit).map((item, wi) =>
                    item.lineBreak ? (
                      <br key={wi} />
                    ) : (
                      <span key={wi} className={`text-animation-word ${item.serif ? 'font-pairing-serif' : ''}`} style={{ animationDelay: `${(bulletChunkOffsets[index] + wi) * chunkDelay}s` }}>
                        {item.word != null ? item.word + ' ' : item.text}
                      </span>
                    )
                  )}
                </span>
              ) : (
                <span
                  className="bullet-text"
                  style={getBulletStyle(index)}
                >
                  <span dangerouslySetInnerHTML={{ __html: formatContentForDisplay(bullet) }} />
                </span>
              )}
            </div>
          ))}
        </div>
      )
    }

    if (layout === 'section') {
      return (
        <div key={slide.id} className="slide-section-text">
          <div 
            ref={contentRef}
            className={`slide-section-name ${textHeadingLevel ? `text-heading-${textHeadingLevel}` : ''}`}
            style={textStyle}
            contentEditable={isEditable ? 'true' : 'false'}
            suppressContentEditableWarning={true}
            onBlur={handleContentChange}
            onFocus={handleContentFocus}
            onContextMenu={(e) => handleFontPairingContextMenu(e, 'content')}
            onClick={(e) => {
              if (isEditable) {
                e.stopPropagation()
              }
            }}
        onKeyDown={(e) => handleLineBreakKey(e, contentRef)}
        onInput={(e) => {
          // Mark as editing immediately when user types
          isEditingContentRef.current = true
        }}
        dangerouslySetInnerHTML={{ __html: formatContentForDisplay(slide.content) }}
          />
        </div>
      )
    }

    if (layout === 'centered') {
      const subtitleHasContent = hasSubtitleContent()
      const centeredChunks = useChunkedText ? getChunksWithFormatting(slide.content || '', textAnimationUnit) : []

      return (
        <div key={slide.id} className="slide-text-centered-wrapper">
          {isPlayMode ? (
            useChunkedText ? (
              <div
                ref={contentRef}
                className={`slide-text slide-text-words centered ${textHeadingLevel ? `text-heading-${textHeadingLevel}` : ''}`}
                style={textStyle}
              >
                {renderChunksWithHeadings(centeredChunks, chunkDelay)}
              </div>
            ) : visibleLineIndex !== null ? (
              <div className={`slide-text slide-reveal-lines centered ${textHeadingLevel ? `text-heading-${textHeadingLevel}` : ''}`} style={textStyle}>
                {getContentLines(slide.content || '').map((line, i) => (
                  <div
                    key={i}
                    className={`slide-reveal-line ${i > visibleLineIndex ? 'slide-reveal-line-hidden' : ''}`}
                    style={textStyle}
                    dangerouslySetInnerHTML={{ __html: formatContentForDisplay(line) }}
                  />
                ))}
              </div>
            ) : (
              <div 
                ref={contentRef}
                className={`slide-text centered ${textHeadingLevel ? `text-heading-${textHeadingLevel}` : ''}`}
                style={textStyle}
                dangerouslySetInnerHTML={{ __html: formatContentForDisplay(slide.content) }}
              />
            )
          ) : isEditable ? (
            <div
              ref={contentRef}
              className={`slide-text centered ${textHeadingLevel ? `text-heading-${textHeadingLevel}` : ''}`}
              style={textStyle}
              contentEditable="true"
              suppressContentEditableWarning={true}
              onBlur={handleContentChange}
              onFocus={handleContentFocus}
              onContextMenu={(e) => textStyleMode === 'fontPairing' && handleFontPairingContextMenu(e, 'content')}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => handleLineBreakKey(e, contentRef)}
              onInput={() => { isEditingContentRef.current = true }}
            />
          ) : (
            <div 
              ref={contentRef}
              className={`slide-text centered ${textHeadingLevel ? `text-heading-${textHeadingLevel}` : ''}`}
              style={textStyle}
              dangerouslySetInnerHTML={{ __html: formatContentForDisplay(slide.content || '') }}
            />
          )}
          {subtitleHasContent ? (
            <div 
              ref={subtitleRef}
              className={`slide-subtitle ${subtitleHeadingLevel ? `text-heading-${subtitleHeadingLevel}` : ''}`}
              style={subtitleStyle}
              contentEditable={isEditable ? 'true' : 'false'}
              suppressContentEditableWarning={true}
              onBlur={handleSubtitleChange}
              onFocus={handleSubtitleFocus}
              onContextMenu={(e) => handleFontPairingContextMenu(e, 'subtitle')}
              onClick={(e) => {
                if (isEditable) {
                  e.stopPropagation()
                }
              }}
              onKeyDown={(e) => handleLineBreakKey(e, subtitleRef)}
              dangerouslySetInnerHTML={{ __html: formatContentForDisplay(slide.subtitle) }}
            />
          ) : isEditable ? (
            <div 
              className="slide-subtitle slide-subtitle-placeholder"
              style={textStyle}
              contentEditable="true"
              suppressContentEditableWarning={true}
              onBlur={(e) => {
                const text = e.target.textContent || e.target.innerText || ''
                // Only save if there's actual content (not just placeholder)
                if (text.trim() && text.trim() !== 'Subtitle (optional)') {
                  handleSubtitleChange(e)
                }
              }}
              onKeyDown={(e) => handleLineBreakKey(e, null)}
              data-placeholder="Subtitle (optional)"
              onFocus={(e) => {
                if (e.target.textContent === 'Subtitle (optional)') {
                  e.target.textContent = ''
                }
              }}
            />
          ) : null}
        </div>
      )
    }

    // For play mode, render as div with formatted content (or chunk spans when text animation is on)
    // When "show one line at a time" is on (visibleLineIndex !== null), always use line-by-line reveal
    if (isPlayMode) {
      if (visibleLineIndex !== null) {
        const lines = getContentLines(slide.content || '')
        return (
          <div
            className={`slide-text slide-reveal-lines ${layout === 'centered' ? 'centered' : ''} ${layout === 'right' ? 'right' : ''} ${layout === 'left-video' ? 'left-video' : ''} ${layout === 'right-video' ? 'right-video' : ''} ${textHeadingLevel ? `text-heading-${textHeadingLevel}` : ''} ${dynamicClass}`}
            style={textStyle}
          >
            {lines.map((line, i) => (
              <div
                key={i}
                className={`slide-reveal-line ${i > visibleLineIndex ? 'slide-reveal-line-hidden' : ''}`}
                style={textStyle}
                dangerouslySetInnerHTML={{ __html: formatContentForDisplay(line) }}
              />
            ))}
          </div>
        )
      }
      if (useChunkedText) {
        const chunks = getChunksWithFormatting(slide.content || '', textAnimationUnit)
        return (
          <div
            className={`slide-text slide-text-words ${layout === 'centered' ? 'centered' : ''} ${layout === 'right' ? 'right' : ''} ${layout === 'left-video' ? 'left-video' : ''} ${layout === 'right-video' ? 'right-video' : ''} ${textHeadingLevel ? `text-heading-${textHeadingLevel}` : ''} ${dynamicClass}`}
            style={textStyle}
          >
            {renderChunksWithHeadings(chunks, chunkDelay)}
          </div>
        )
      }
      return (
        <div
          className={`slide-text ${layout === 'centered' ? 'centered' : ''} ${layout === 'right' ? 'right' : ''} ${layout === 'left-video' ? 'left-video' : ''} ${layout === 'right-video' ? 'right-video' : ''} ${textHeadingLevel ? `text-heading-${textHeadingLevel}` : ''} ${dynamicClass}`}
          style={textStyle}
          dangerouslySetInnerHTML={{ __html: formatContentForDisplay(slide.content || '') }}
        />
      )
    }
    
    // In edit mode use contentEditable so user can select text and use format toolbar (bold, italic, etc.)
    if (isEditable) {
      return (
        <div
          ref={contentRef}
          className={`slide-text ${layout === 'centered' ? 'centered' : ''} ${layout === 'right' ? 'right' : ''} ${layout === 'left-video' ? 'left-video' : ''} ${layout === 'right-video' ? 'right-video' : ''} ${textHeadingLevel ? `text-heading-${textHeadingLevel}` : ''} ${dynamicClass}`}
          style={textStyle}
          contentEditable="true"
          suppressContentEditableWarning={true}
          onBlur={handleContentChange}
          onFocus={handleContentFocus}
          onContextMenu={(e) => textStyleMode === 'fontPairing' && handleFontPairingContextMenu(e, 'content')}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => handleLineBreakKey(e, contentRef)}
          onInput={() => { isEditingContentRef.current = true }}
        />
      )
    }
    
    return null
  }

  // Get font family for each heading (fallback to main fontFamily if not set)
  const getHeadingFont = (headingFont) => {
    return headingFont || fontFamily
  }

  // Handle image dragging
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ mouseX: 0, mouseY: 0, imageX: 0, imageY: 0 })
  const [currentPosition, setCurrentPosition] = useState({ x: imagePositionX, y: imagePositionY })
  const slideRef = useRef(null)

  // Update current position when imagePositionX/Y changes from outside
  useEffect(() => {
    if (!isDragging) {
      setCurrentPosition({ x: imagePositionX, y: imagePositionY })
    }
  }, [imagePositionX, imagePositionY, isDragging])

  // Set base font-size as percentage of slide width for consistent scaling; respect defaultTextSize (rem)
  useEffect(() => {
    const updateFontSize = () => {
      if (slideRef.current) {
        const slideWidth = slideRef.current.offsetWidth
        // At 1200px width, base = defaultTextSize * 16px (e.g. 5rem -> 80px at 16px root); scales with slide width
        if (slideWidth > 0) {
          const baseFontSize = (slideWidth / 1200) * 16 * defaultTextSize
          slideRef.current.style.setProperty('--slide-base-font-size', `${baseFontSize}px`)
          const bulletFontSize = (slideWidth / 1200) * 16 * bulletTextSize
          slideRef.current.style.setProperty('--slide-bullet-font-size', `${bulletFontSize}px`)
        }
      }
    }
    
    // Initial update with a small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      updateFontSize()
    }, 0)
    
    // Update on resize (handles both preview and present mode resizing)
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(updateFontSize)
    })
    
    if (slideRef.current) {
      resizeObserver.observe(slideRef.current)
    }
    
    const handleResize = () => {
      requestAnimationFrame(updateFontSize)
    }
    window.addEventListener('resize', handleResize)
    
    const handleFullscreenChange = () => {
      setTimeout(() => {
        requestAnimationFrame(updateFontSize)
      }, 100)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    
    return () => {
      clearTimeout(timeoutId)
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [isPlayMode, defaultTextSize, bulletTextSize]) // Re-run when play mode or text sizes change

  const handleImageMouseDown = (e) => {
    if (!onUpdate || isPlayMode || (!slide.imageUrl && !slide.backgroundVideoUrl)) return
    // Only start dragging if clicking directly on the background, not on text content
    // Check if the click is on a text element (these have pointerEvents: auto)
    const target = e.target
    const isTextElement = target.classList.contains('slide-text') || 
                         target.classList.contains('slide-subtitle') || 
                         target.classList.contains('bullet-text') || 
                         target.classList.contains('slide-section-name') ||
                         target.closest('.slide-text, .slide-subtitle, .bullet-text, .slide-section-name')
    
    if (isTextElement) {
      return
    }
    e.preventDefault()
    e.stopPropagation()
    const rect = slideRef.current?.getBoundingClientRect()
    if (rect) {
      const mouseX = e.clientX
      const mouseY = e.clientY
      setIsDragging(true)
      setDragStart({ 
        mouseX, 
        mouseY, 
        imageX: imagePositionX, 
        imageY: imagePositionY 
      })
      setCurrentPosition({ x: imagePositionX, y: imagePositionY })
    }
  }

  const handleImageMouseMove = useCallback((e) => {
    if (!isDragging || !onUpdate || isPlayMode || (!slide.imageUrl && !slide.backgroundVideoUrl)) return
    e.preventDefault()
    const rect = slideRef.current?.getBoundingClientRect()
    if (rect) {
      // Calculate delta in percentage, but invert to match mouse movement direction
      const deltaX = ((e.clientX - dragStart.mouseX) / rect.width) * 100
      const deltaY = ((e.clientY - dragStart.mouseY) / rect.height) * 100
      
      // Invert the direction so image follows mouse movement
      const newX = Math.max(0, Math.min(100, dragStart.imageX - deltaX))
      const newY = Math.max(0, Math.min(100, dragStart.imageY - deltaY))
      
      setCurrentPosition({ x: newX, y: newY })
    }
  }, [isDragging, dragStart, onUpdate, isPlayMode, slide.imageUrl, slide.backgroundVideoUrl])

  const handleImageMouseUp = useCallback(() => {
    if (isDragging && onUpdate && !isPlayMode && (slide.imageUrl || slide.backgroundVideoUrl)) {
      // Save the final position when releasing
      onUpdate({ 
        imagePositionX: currentPosition.x, 
        imagePositionY: currentPosition.y 
      })
    }
    setIsDragging(false)
  }, [isDragging, currentPosition, onUpdate, isPlayMode, slide.imageUrl, slide.backgroundVideoUrl])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleImageMouseMove)
      window.addEventListener('mouseup', handleImageMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleImageMouseMove)
        window.removeEventListener('mouseup', handleImageMouseUp)
      }
    }
  }, [isDragging, handleImageMouseMove, handleImageMouseUp])

  const textAnimationClass = isPlayMode && textAnimation && textAnimation !== 'none' ? `text-animation-${textAnimation}` : ''

  const aspectRatioValue = slideFormat === '1:1' ? '1/1' : slideFormat === '9:16' ? '9/16' : '16/9'
  const formatClass = slideFormat === '1:1' ? 'slide-format-1-1' : slideFormat === '9:16' ? 'slide-format-9-16' : 'slide-format-16-9'
  const slideStyle = {
    backgroundColor: hideBackground ? 'transparent' : slideBgColor,
    aspectRatio: aspectRatioValue,
    '--slide-base-font-size': `${defaultTextSize}rem`,
    '--slide-pairing-font': `"${fontPairingSerifFont}", serif`,
    '--slide-content-bottom': `${contentBottomOffset}%`,
    '--slide-content-edge': `${contentEdgeOffset}%`
  }
  return (
    <div 
      className={`slide ${formatClass} ${!textInlineBackground ? 'no-text-highlight' : ''} ${textAnimationClass} ${isPlayMode ? 'play-mode' : ''} ${layout === 'left-video' ? 'layout-left-video' : ''} ${layout === 'right-video' ? 'layout-right-video' : ''}`}
      ref={slideRef} 
      style={slideStyle}
      onMouseDown={(!isPlayMode && onUpdate && (slide.imageUrl || slide.backgroundVideoUrl)) ? handleImageMouseDown : undefined}
    >
      <style>{`
        /* Default font weight for body text in slide content */
        .slide .slide-content .slide-text,
        .slide .slide-content-video .slide-text,
        .slide .slide-subtitle,
        .slide .bullet-text {
          font-weight: ${defaultFontWeight} !important;
        }
        /* H1/H2/H3 in edit and present mode */
        .slide .slide-content h1,
        .slide .slide-content-video h1,
        .slide.play-mode .slide-content h1,
        .slide.play-mode .slide-content-video h1 {
          font-size: ${h1Size}rem !important;
          font-family: "${getHeadingFont(h1FontFamily)}", sans-serif !important;
          font-weight: ${h1Weight} !important;
          line-height: ${Math.min(lineHeight, 1.15).toFixed(2)} !important;
        }
        .slide .slide-content h2,
        .slide .slide-content-video h2,
        .slide.play-mode .slide-content h2,
        .slide.play-mode .slide-content-video h2 {
          font-size: ${h2Size}rem !important;
          font-family: "${getHeadingFont(h2FontFamily)}", sans-serif !important;
          font-weight: ${h2Weight} !important;
          line-height: ${Math.min(lineHeight * 0.92, 1.15).toFixed(2)} !important;
        }
        .slide .slide-content h3,
        .slide .slide-content-video h3,
        .slide.play-mode .slide-content h3,
        .slide.play-mode .slide-content-video h3 {
          font-size: ${h3Size}rem !important;
          font-family: "${getHeadingFont(h3FontFamily)}", sans-serif !important;
          font-weight: ${h3Weight} !important;
          line-height: ${Math.min(lineHeight * 0.85, 1.1).toFixed(2)} !important;
        }
        .slide .slide-subtitle h1,
        .slide.play-mode .slide-subtitle h1 {
          font-size: ${h1Size * 0.5}rem !important;
          font-family: "${getHeadingFont(h1FontFamily)}", sans-serif !important;
          font-weight: ${h1Weight} !important;
          line-height: ${Math.min(lineHeight, 1.15).toFixed(2)} !important;
        }
        .slide .slide-subtitle h2,
        .slide.play-mode .slide-subtitle h2 {
          font-size: ${h2Size * 0.5}rem !important;
          font-family: "${getHeadingFont(h2FontFamily)}", sans-serif !important;
          font-weight: ${h2Weight} !important;
          line-height: ${Math.min(lineHeight * 0.92, 1.15).toFixed(2)} !important;
        }
        .slide .slide-subtitle h3,
        .slide.play-mode .slide-subtitle h3 {
          font-size: ${h3Size * 0.5}rem !important;
          font-family: "${getHeadingFont(h3FontFamily)}", sans-serif !important;
          font-weight: ${h3Weight} !important;
          line-height: ${Math.min(lineHeight * 0.85, 1.1).toFixed(2)} !important;
        }
        /* Block-level H3: when subtitle/content has text-heading-h3 class (edit + present) */
        .slide .slide-subtitle.text-heading-h3,
        .slide .slide-text.text-heading-h3,
        .slide.play-mode .slide-subtitle.text-heading-h3,
        .slide.play-mode .slide-text.text-heading-h3 {
          font-size: ${h3Size * 0.5}rem !important;
          font-family: "${getHeadingFont(h3FontFamily)}", sans-serif !important;
          font-weight: ${h3Weight} !important;
          line-height: ${Math.min(lineHeight * 0.85, 1.1).toFixed(2)} !important;
        }
        .slide .slide-content .slide-text.text-heading-h3,
        .slide .slide-content-video .slide-text.text-heading-h3,
        .slide.play-mode .slide-content .slide-text.text-heading-h3,
        .slide.play-mode .slide-content-video .slide-text.text-heading-h3 {
          font-size: ${h3Size}rem !important;
          font-family: "${getHeadingFont(h3FontFamily)}", sans-serif !important;
          font-weight: ${h3Weight} !important;
          line-height: ${Math.min(lineHeight * 0.85, 1.1).toFixed(2)} !important;
        }
        .slide .bullet-text h1,
        .slide.play-mode .bullet-text h1 {
          font-size: ${h1Size * 0.6}rem !important;
          font-family: "${getHeadingFont(h1FontFamily)}", sans-serif !important;
          font-weight: ${h1Weight} !important;
          line-height: ${Math.min(lineHeight, 1.15).toFixed(2)} !important;
        }
        .slide .bullet-text h2,
        .slide.play-mode .bullet-text h2 {
          font-size: ${h2Size * 0.6}rem !important;
          font-family: "${getHeadingFont(h2FontFamily)}", sans-serif !important;
          font-weight: ${h2Weight} !important;
          line-height: ${Math.min(lineHeight * 0.92, 1.15).toFixed(2)} !important;
        }
        .slide .bullet-text h3,
        .slide.play-mode .bullet-text h3 {
          font-size: ${h3Size * 0.6}rem !important;
          font-family: "${getHeadingFont(h3FontFamily)}", sans-serif !important;
          font-weight: ${h3Weight} !important;
          line-height: ${Math.min(lineHeight * 0.85, 1.1).toFixed(2)} !important;
        }
        .slide .slide-content .font-pairing-serif,
        .slide .slide-subtitle .font-pairing-serif,
        .slide .bullet-text .font-pairing-serif,
        .slide .slide-section-name .font-pairing-serif {
          font-family: var(--slide-pairing-font, "${fontPairingSerifFont}", serif) !important;
          display: inline;
        }
      `}</style>
      {/* 1. Background image (z-index 0) - behind video */}
      {!hideBackground && slide.imageUrl && !slide.backgroundVideoUrl && layout !== 'section' && (
        <div
          className={`slide-background ${(!isPlayMode && onUpdate) ? 'editable' : ''} ${isPlayMode && backgroundScaleAnimation ? 'background-scale-animation' : ''}`}
          style={{ 
            backgroundImage: `url(${slide.imageUrl})`,
            backgroundSize: `${imageScale * 100}%`,
            backgroundPosition: `${currentPosition.x}% ${currentPosition.y}%`,
            opacity: backgroundOpacity,
            transform: slide.flipHorizontal ? 'scaleX(-1)' : 'none',
            cursor: (!isPlayMode && onUpdate) ? 'move' : 'default',
            pointerEvents: (!isPlayMode && onUpdate) ? 'auto' : 'none',
            ...(isPlayMode && backgroundScaleAnimation ? {
              '--scale-duration': `${backgroundScaleTime}s`,
              '--initial-scale': `${imageScale * 100}%`,
              '--final-scale': `${(imageScale * 100) + (backgroundScaleAmount || 20)}%`
            } : {})
          }}
        />
      )}
      {/* 2. Background video (z-index 1) - in front of image, behind gradient and content; same scale/position as image */}
      {!hideBackground && slide.backgroundVideoUrl && layout !== 'section' && (() => {
        const raw = slide.backgroundVideoUrl
        const isExternal = raw.startsWith('http://') || raw.startsWith('https://')
        const videoSrc = isExternal ? (backgroundVideoSrc || raw) : raw
        const videoEditable = !isPlayMode && onUpdate
        return (
          <div
            className={`slide-background slide-background-video ${videoEditable ? 'editable' : ''}`}
            aria-hidden="true"
            style={{
              pointerEvents: videoEditable ? 'auto' : 'none',
              cursor: videoEditable ? 'move' : undefined
            }}
          >
            <video
              ref={(el) => {
                backgroundVideoRef.current = el
                if (el && !isPreload) el.play().catch(() => {})
              }}
              src={videoSrc}
              crossOrigin={isExternal ? 'anonymous' : undefined}
              autoPlay={!isPreload}
              loop
              muted
              playsInline
              preload="auto"
              className="slide-background-video-el"
              style={{
                objectFit: 'cover',
                objectPosition: `${currentPosition.x}% ${currentPosition.y}%`,
                transform: `${slide.flipHorizontal ? 'scaleX(-1) ' : ''}scale(${imageScale})`,
                transformOrigin: `${currentPosition.x}% ${currentPosition.y}%`,
                width: '100%',
                height: '100%'
              }}
            />
          </div>
        )
      })()}
      {layout !== 'centered' && layout !== 'right' && layout !== 'section' && layout !== 'video' && layout !== 'left-video' && layout !== 'right-video' && (slide.imageUrl || slide.backgroundVideoUrl) && (
        <div 
          className="slide-gradient-overlay"
          style={{
            background: gradientFlipped
              ? `linear-gradient(to right, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${maxOpacity}) 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${midOpacity}) 30%, transparent 100%)`
              : `linear-gradient(to left, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${maxOpacity}) 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${midOpacity}) 30%, transparent 100%)`,
            pointerEvents: (!isPlayMode && onUpdate && (slide.imageUrl || slide.backgroundVideoUrl)) ? 'none' : 'auto'
          }}
        />
      )}
      {webcamEnabled && selectedCameraId && !(cameraOverrideEnabled && cameraOverridePosition === 'disabled') && (
        <WebcamVideo 
          cameraId={selectedCameraId}
          layout={layout}
          isPlayMode={isPlayMode}
          flipHorizontal={webcamFlipHorizontal}
          videoBrightness={videoBrightness}
          videoContrast={videoContrast}
          videoSaturation={videoSaturation}
          videoShadows={videoShadows}
          videoMidtones={videoMidtones}
          videoHighlights={videoHighlights}
          videoShadowHue={videoShadowHue}
          videoMidHue={videoMidHue}
          videoHighlightHue={videoHighlightHue}
          cameraOverrideEnabled={cameraOverrideEnabled}
          cameraOverridePosition={cameraOverridePosition}
        />
      )}
      {layout === 'video' && (
        <div 
          className="slide-gradient-overlay slide-gradient-overlay-video"
          style={{
            background: gradientFlipped
              ? `linear-gradient(to right, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${maxOpacity}) 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${midOpacity}) 30%, transparent 100%)`
              : `linear-gradient(to left, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${maxOpacity}) 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${midOpacity}) 30%, transparent 100%)`,
            pointerEvents: 'none',
            zIndex: 1000
          }}
        />
      )}
      {layout === 'video' ? (
        slide.content && (
          <div 
            className="slide-content slide-content-video"
            style={{ 
              color: textColor,
              fontFamily: `"${fontFamily}", sans-serif`,
              zIndex: 1001, // Higher than webcam overlay (1000) to appear on top
              ...(isPlayMode ? {
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none'
              } : { position: 'relative' })
            }}
          >
            {renderContent()}
          </div>
        )
      ) : (
        <div 
          className={`slide-content ${layout === 'default' ? 'default' : ''} ${layout === 'centered' ? 'centered' : ''} ${layout === 'right' ? 'right' : ''} ${layout === 'section' ? 'section' : ''} ${layout === 'bulletpoints' ? 'bulletpoints' : ''} ${layout === 'left-video' ? 'left-video' : ''} ${layout === 'right-video' ? 'right-video' : ''}`}
          style={{ 
            color: textColor,
            fontFamily: `"${fontFamily}", sans-serif`,
            pointerEvents: (!isPlayMode && onUpdate) ? 'auto' : undefined,
            ...(cameraOverrideEnabled && cameraOverridePosition === 'fullscreen' ? { zIndex: 1001 } : {})
          }}
        >
          {renderContent()}
        </div>
      )}
      {fontPairingMenu && (
        <div
          className="slide-font-pairing-menu"
          style={{ left: fontPairingMenu.x, top: fontPairingMenu.y }}
          role="menu"
        >
          <button type="button" className="slide-font-pairing-menu-item" onClick={applySerifToSelection}>
            Use serif font
          </button>
          <button type="button" className="slide-font-pairing-menu-item" onClick={removeSerifFromSelection}>
            Remove serif font
          </button>
        </div>
      )}
      {textFormatToolbar && createPortal(
        <TextFormatToolbar
          x={textFormatToolbar.x}
          y={textFormatToolbar.y}
          boldActive={textFormatToolbar.boldActive}
          italicActive={textFormatToolbar.italicActive}
          underlineActive={textFormatToolbar.underlineActive}
          strikethroughActive={textFormatToolbar.strikethroughActive}
          backgroundActive={textFormatToolbar.backgroundActive}
          headingActive={textFormatToolbar.headingActive}
          serifActive={textFormatToolbar.serifActive}
          textColorActive={textFormatToolbar.textColorActive ?? null}
          onClose={closeTextFormatToolbar}
          onBold={applyBold}
          onItalic={applyItalic}
          onUnderline={applyUnderline}
          onStrikethrough={applyStrikethrough}
          onBackground={applyBackground}
          onH1={() => applyHeading('h1')}
          onH2={() => applyHeading('h2')}
          onH3={() => applyHeading('h3')}
          onFontPairing={applyFontPairing}
          onTextColor={applyTextColor}
          onClearFormatting={applyClearFormatting}
        />,
        document.body
      )}
    </div>
  )
}

export default Slide

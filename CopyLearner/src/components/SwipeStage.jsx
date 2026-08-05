import React, { useEffect, useRef, useState } from 'react'

const DRAG_THRESHOLD = 60
const AXIS_LOCK_MIN = 10
const WHEEL_COOLDOWN_MS = 550

/**
 * Full-screen gesture stage: swipe left/right to change slide within a
 * lesson, swipe up/down to move between lessons. Also supports wheel
 * (trackpad) and arrow keys for desktop.
 */
export default function SwipeStage({ children, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown }) {
  const [drag, setDrag] = useState({ x: 0, y: 0, axis: null, animating: false })
  const dragInfo = useRef({ startX: 0, startY: 0, active: false, axis: null })
  const wheelLock = useRef(0)
  const containerRef = useRef(null)

  const handlers = useRef({ onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown })
  handlers.current = { onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown }

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // Let a click-drag that starts on slide text become a native text
    // selection instead of a card swipe — don't arm the drag for it.
    const startsOnText = !!(e.target.closest && e.target.closest('.select-text'))
    dragInfo.current = { startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, active: !startsOnText, axis: null }
  }

  const onPointerMove = (e) => {
    const info = dragInfo.current
    if (!info.active) return
    const dx = e.clientX - info.startX
    const dy = e.clientY - info.startY
    info.dx = dx
    info.dy = dy
    if (!info.axis && (Math.abs(dx) > AXIS_LOCK_MIN || Math.abs(dy) > AXIS_LOCK_MIN)) {
      info.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }
    if (info.axis === 'x') setDrag({ x: dx, y: 0, axis: 'x', animating: false })
    else if (info.axis === 'y') setDrag({ x: 0, y: dy, axis: 'y', animating: false })
  }

  // Reads dragInfo (a ref, always current) rather than the `drag` state,
  // which may not have committed yet if pointerup follows pointermove
  // within the same task — relying on state here could see a stale axis.
  const endDrag = () => {
    const info = dragInfo.current
    if (!info.active) return
    info.active = false
    const { dx, dy, axis } = info
    if (axis === 'x' && Math.abs(dx) >= DRAG_THRESHOLD) {
      if (dx < 0) handlers.current.onSwipeLeft?.()
      else handlers.current.onSwipeRight?.()
    } else if (axis === 'y' && Math.abs(dy) >= DRAG_THRESHOLD) {
      if (dy < 0) handlers.current.onSwipeUp?.()
      else handlers.current.onSwipeDown?.()
    }
    setDrag({ x: 0, y: 0, axis: null, animating: true })
  }

  const onWheel = (e) => {
    const now = Date.now()
    if (now - wheelLock.current < WHEEL_COOLDOWN_MS) return
    const absX = Math.abs(e.deltaX)
    const absY = Math.abs(e.deltaY)
    if (Math.max(absX, absY) < 24) return
    wheelLock.current = now
    if (absX > absY) {
      if (e.deltaX > 0) handlers.current.onSwipeLeft?.()
      else handlers.current.onSwipeRight?.()
    } else {
      if (e.deltaY > 0) handlers.current.onSwipeDown?.()
      else handlers.current.onSwipeUp?.()
    }
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') handlers.current.onSwipeRight?.()
      else if (e.key === 'ArrowRight') handlers.current.onSwipeLeft?.()
      else if (e.key === 'ArrowUp') handlers.current.onSwipeUp?.()
      else if (e.key === 'ArrowDown') handlers.current.onSwipeDown?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const tx = drag.axis === 'x' ? drag.x * 0.35 : 0
  const ty = drag.axis === 'y' ? drag.y * 0.35 : 0
  const rot = drag.axis === 'x' ? drag.x * 0.015 : 0

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onWheel={onWheel}
      style={{ height: '100%', width: '100%', touchAction: 'none', position: 'relative' }}
    >
      <div
        style={{
          height: '100%',
          width: '100%',
          transform: `translate(${tx}px, ${ty}px) rotate(${rot}deg)`,
          transition: drag.animating ? 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  )
}

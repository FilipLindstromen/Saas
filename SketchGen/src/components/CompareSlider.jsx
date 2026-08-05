import { useRef, useState } from 'react'
import './CompareSlider.css'

export default function CompareSlider({ beforeSrc, afterSrc, onAfterContextMenu }) {
  const containerRef = useRef(null)
  const [position, setPosition] = useState(50)
  const draggingRef = useRef(false)

  const updateFromClientX = (clientX) => {
    const rect = containerRef.current.getBoundingClientRect()
    const pct = ((clientX - rect.left) / rect.width) * 100
    setPosition(Math.min(100, Math.max(0, pct)))
  }

  const handlePointerDown = (e) => {
    draggingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    updateFromClientX(e.clientX)
  }

  const handlePointerMove = (e) => {
    if (!draggingRef.current) return
    updateFromClientX(e.clientX)
  }

  const handlePointerUp = () => {
    draggingRef.current = false
  }

  return (
    <div className="compare-slider" ref={containerRef}>
      <img className="compare-slider-image compare-slider-before" src={beforeSrc} alt="Sketch" />
      <div className="compare-slider-after-wrap" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        <img
          className="compare-slider-image"
          src={afterSrc}
          alt="Generated illustration"
          onContextMenu={(e) => onAfterContextMenu?.(e, afterSrc)}
        />
      </div>
      <span className="compare-slider-label compare-slider-label-left">Sketch</span>
      <span className="compare-slider-label compare-slider-label-right">Generated</span>
      <div
        className="compare-slider-handle"
        style={{ left: `${position}%` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div className="compare-slider-handle-grip">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 5l-5 7 5 7" />
            <path d="M16 5l5 7-5 7" />
          </svg>
        </div>
      </div>
    </div>
  )
}

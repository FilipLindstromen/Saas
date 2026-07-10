import { useRef } from 'react'
import './PreviewPanel.css'

export default function PreviewPanel({
  canvasRef,
  format,
  aspectRatio,
  onPan,
  canPan,
}) {
  const containerRef = useRef(null)
  const dragRef = useRef(null)

  const handlePointerDown = (e) => {
    if (!canPan) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      displayScale: Math.min(rect.width / format.width, rect.height / format.height),
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    dragRef.current.startX = e.clientX
    dragRef.current.startY = e.clientY
    const scale = dragRef.current.displayScale || 1
    onPan(dx / scale, dy / scale)
  }

  const handlePointerUp = (e) => {
    dragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}
  }

  return (
    <div className="nag-preview-wrap">
      <div className="nag-preview-header">
        <h2 className="nag-preview-title">Preview</h2>
        <span className="nag-preview-size">{format.label}</span>
      </div>
      <div
        ref={containerRef}
        className={`nag-preview-stage ${canPan ? 'draggable' : ''}`}
        style={{
          aspectRatio,
          '--format-ar-w': format.width,
          '--format-ar-h': format.height,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <canvas ref={canvasRef} className="nag-preview-canvas" />
        {canPan && <span className="nag-preview-drag-hint">Drag to reposition media</span>}
      </div>
    </div>
  )
}

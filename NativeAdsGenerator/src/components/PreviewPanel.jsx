import { useRef, useState } from 'react'
import { isImageFile, isVideoFile } from '../utils/mediaFiles'
import './PreviewPanel.css'

export default function PreviewPanel({
  canvasRef,
  format,
  aspectRatio,
  onPan,
  canPan,
  onUploadImage,
  onUploadVideo,
}) {
  const containerRef = useRef(null)
  const dragRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [dropError, setDropError] = useState(null)
  const [dropping, setDropping] = useState(false)

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

  const handleDragOver = (e) => {
    if (!onUploadImage && !onUploadVideo) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOver(true)
  }

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOver(false)
    }
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    setDragOver(false)
    setDropError(null)
    const file = e.dataTransfer.files?.[0]
    if (!file) return

    setDropping(true)
    try {
      if (isVideoFile(file) && onUploadVideo) {
        await onUploadVideo(file)
      } else if (isImageFile(file) && onUploadImage) {
        await onUploadImage(file)
      } else {
        setDropError('Drop an image or video file (MP4, MOV, WebM, JPG, PNG, etc.).')
      }
    } catch (err) {
      setDropError(err?.message || 'Failed to load file')
    } finally {
      setDropping(false)
    }
  }

  const canDrop = !!(onUploadImage || onUploadVideo)

  return (
    <div className="nag-preview-wrap">
      <div className="nag-preview-header">
        <h2 className="nag-preview-title">Preview</h2>
        <span className="nag-preview-size">{format.label}</span>
      </div>
      {dropError && <p className="nag-preview-drop-error">{dropError}</p>}
      <div
        ref={containerRef}
        className={`nag-preview-stage ${canPan ? 'draggable' : ''} ${dragOver ? 'drag-over' : ''}`}
        style={{
          aspectRatio,
          '--format-ar-w': format.width,
          '--format-ar-h': format.height,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDragOver={canDrop ? handleDragOver : undefined}
        onDragLeave={canDrop ? handleDragLeave : undefined}
        onDrop={canDrop ? handleDrop : undefined}
      >
        <canvas ref={canvasRef} className="nag-preview-canvas" />
        {dragOver && (
          <div className="nag-preview-drop-overlay">
            {dropping ? 'Loading…' : 'Drop image or video'}
          </div>
        )}
        {canPan && !dragOver && <span className="nag-preview-drag-hint">Drag to reposition media</span>}
        {canDrop && !canPan && !dragOver && (
          <span className="nag-preview-drag-hint">Drop image or video here</span>
        )}
      </div>
    </div>
  )
}

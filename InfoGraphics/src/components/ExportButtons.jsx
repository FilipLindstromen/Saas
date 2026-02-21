import { useState } from 'react'
import { exportToPng, exportToMp4, exportToClipboard, exportCanvasCodeToClipboard } from '../utils/exportCanvas'
import './ExportButtons.css'

export default function ExportButtons({ canvasRef, includeBackgroundInExport = true, onBeforeExport, canvasData }) {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)

  const runExportCanvasCode = async () => {
    setError(null)
    setStatus('Exporting canvas...')
    try {
      if (!canvasData) throw new Error('No canvas data')
      await exportCanvasCodeToClipboard(canvasData)
      setStatus('Canvas exported')
      setTimeout(() => setStatus(null), 2000)
    } catch (err) {
      setError(err?.message || 'Export failed')
      setStatus(null)
      setTimeout(() => setError(null), 3000)
    }
  }

  const runExport = async (fn, label) => {
    setError(null)
    setStatus(`Exporting ${label}...`)
    let restore
    try {
      restore = onBeforeExport?.()
      await new Promise((r) => setTimeout(r, 50))
      const opts = { includeBackground: includeBackgroundInExport }
      await fn(canvasRef?.current, opts)
      setStatus(`${label} exported`)
      setTimeout(() => setStatus(null), 2000)
    } catch (err) {
      setError(err?.message || 'Export failed')
      setStatus(null)
      setTimeout(() => setError(null), 3000)
    } finally {
      restore?.()
    }
  }

  return (
    <div className="export-buttons">
      <button
        type="button"
        className="toolbar-btn toolbar-btn-export"
        onClick={() => runExport(exportToPng, 'PNG')}
        title="Export as PNG image"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M8 12h8M8 16h8M12 8v12" />
        </svg>
        PNG
      </button>
      <button
        type="button"
        className="toolbar-btn toolbar-btn-export"
        onClick={() => runExport(exportToMp4, 'Video')}
        title="Export as video (MP4/WebM)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
        MP4
      </button>
      <button
        type="button"
        className="toolbar-btn toolbar-btn-export"
        onClick={() => runExport(exportToClipboard, 'Clipboard')}
        title="Copy full resolution to clipboard"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        Clipboard
      </button>
      <button
        type="button"
        className="toolbar-btn toolbar-btn-export"
        onClick={runExportCanvasCode}
        title="Export canvas data (JSON) to clipboard for use in other tools"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M16 13H8M16 17H8M10 9H8" />
        </svg>
        Export Canvas
      </button>
      {status && <span className="export-status">{status}</span>}
      {error && <span className="export-error">{error}</span>}
    </div>
  )
}

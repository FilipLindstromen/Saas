import { useCallback, useRef, useState } from 'react'
import LineEditor from '../components/LineEditor'
import BRollSearchPanel from '../components/BRollSearchPanel'
import PreviewPlayer, { type PreviewPlayerHandle } from '../components/PreviewPlayer'
import { addDelay, removeDelay, updateDelayDuration } from '../services/cuts'
import type { AspectRatio, BRollTransition, Line, Project, SearchSourceToggles, StockResult } from '../types'
import './EditTab.css'

type Props = {
  project: Project
  onProjectChange: (updater: (p: Project) => Project) => void
  apiKeys: { pexels: string; pixabay: string; unsplash: string }
  toggles: SearchSourceToggles
  onTogglesChange: (t: SearchSourceToggles) => void
  selectedLineIds: Set<string>
  onToggleLineSelection: (lineId: string) => void
}

const ASPECT_OPTIONS: { value: AspectRatio; label: string }[] = [
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' },
]

export default function EditTab({ project, onProjectChange, apiKeys, toggles, onTogglesChange, selectedLineIds, onToggleLineSelection }: Props) {
  const [activeLineId, setActiveLineId] = useState<string | null>(null)
  const [linesPanelWidth, setLinesPanelWidth] = useState(380)
  const [panelWidth, setPanelWidth] = useState(340)
  const previewRef = useRef<PreviewPlayerHandle>(null)

  const handleLinesChange = useCallback((lines: Line[]) => {
    onProjectChange((p) => ({ ...p, lines }))
  }, [onProjectChange])

  const assignBroll = useCallback((lineId: string, result: StockResult, transition: BRollTransition) => {
    onProjectChange((p) => ({
      ...p,
      lines: p.lines.map((line) =>
        line.id === lineId
          ? { ...line, broll: { type: result.type, url: result.url, thumbnailUrl: result.thumbnailUrl, source: result.source, kenBurns: result.type === 'image', transition } }
          : line
      ),
    }))
  }, [onProjectChange])

  const handleSelect = useCallback((result: StockResult, transition: BRollTransition) => {
    if (!activeLineId) return
    assignBroll(activeLineId, result, transition)
  }, [activeLineId, assignBroll])

  const handleTransitionChange = useCallback((transition: BRollTransition) => {
    if (!activeLineId) return
    onProjectChange((p) => ({
      ...p,
      lines: p.lines.map((line) =>
        line.id === activeLineId && line.broll ? { ...line, broll: { ...line.broll, transition } } : line
      ),
    }))
  }, [activeLineId, onProjectChange])

  const handleToggleKenBurns = useCallback((lineId: string) => {
    onProjectChange((p) => ({
      ...p,
      lines: p.lines.map((line) =>
        line.id === lineId && line.broll ? { ...line, broll: { ...line.broll, kenBurns: !line.broll.kenBurns } } : line
      ),
    }))
  }, [onProjectChange])

  const handleClear = useCallback((lineId: string) => {
    onProjectChange((p) => ({
      ...p,
      lines: p.lines.map((line) => (line.id === lineId ? { ...line, broll: null } : line)),
    }))
  }, [onProjectChange])

  const handleSearch = useCallback((lineId: string) => {
    setActiveLineId(lineId)
  }, [])

  const handleSeek = useCallback((lineId: string) => {
    setActiveLineId(lineId)
    const line = project.lines.find((l) => l.id === lineId)
    if (line) previewRef.current?.seekToMs(line.startMs)
  }, [project.lines])

  const handleAddDelay = useCallback((afterLineId: string) => {
    onProjectChange((p) => ({ ...p, delays: addDelay(p.delays, afterLineId, 1000) }))
  }, [onProjectChange])

  const handleUpdateDelay = useCallback((delayId: string, durationMs: number) => {
    onProjectChange((p) => ({ ...p, delays: updateDelayDuration(p.delays, delayId, durationMs) }))
  }, [onProjectChange])

  const handleRemoveDelay = useCallback((delayId: string) => {
    onProjectChange((p) => ({ ...p, delays: removeDelay(p.delays, delayId) }))
  }, [onProjectChange])

  const activeLine = project.lines.find((l) => l.id === activeLineId) || null

  if (!project.audioUrl) {
    return (
      <div className="edit-tab edit-tab--empty">
        <p>Record or import a narration clip first, on the "Record / Import / Transcribe" tab.</p>
      </div>
    )
  }

  return (
    <div className="edit-tab">
      <div className="edit-tab__lines-panel" style={{ width: linesPanelWidth }}>
        <div
          className="edit-tab__lines-resize"
          onPointerDown={(e) => {
            e.preventDefault()
            const startX = e.clientX
            const startW = linesPanelWidth
            const move = (ev: PointerEvent) => {
              const dx = ev.clientX - startX
              setLinesPanelWidth(Math.max(280, Math.min(600, startW + dx)))
            }
            const up = () => {
              document.removeEventListener('pointermove', move)
              document.removeEventListener('pointerup', up)
            }
            document.addEventListener('pointermove', move)
            document.addEventListener('pointerup', up)
          }}
        />
        <LineEditor
          words={project.words}
          lines={project.lines}
          activeLineId={activeLineId}
          delays={project.delays}
          selectedLineIds={selectedLineIds}
          onToggleLineSelection={onToggleLineSelection}
          onLinesChange={handleLinesChange}
          onSearch={handleSearch}
          onToggleKenBurns={handleToggleKenBurns}
          onClear={handleClear}
          onSeek={handleSeek}
          onAddDelay={handleAddDelay}
          onUpdateDelay={handleUpdateDelay}
          onRemoveDelay={handleRemoveDelay}
        />
      </div>

      <div className="edit-tab__preview-panel">
        <div className="edit-tab__toolbar">
          <div className="edit-tab__aspect-toggle">
            {ASPECT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`edit-tab__aspect-btn ${project.aspectRatio === opt.value ? 'active' : ''}`}
                onClick={() => onProjectChange((p) => ({ ...p, aspectRatio: opt.value }))}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <PreviewPlayer ref={previewRef} project={project} />
      </div>

      <BRollSearchPanel
        width={panelWidth}
        onResize={setPanelWidth}
        activeLine={activeLine}
        toggles={toggles}
        onTogglesChange={onTogglesChange}
        onSelect={handleSelect}
        onTransitionChange={handleTransitionChange}
        apiKeys={apiKeys}
        brandColor={project.brandColor}
      />
    </div>
  )
}

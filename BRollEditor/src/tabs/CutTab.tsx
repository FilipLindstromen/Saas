import { useCallback, useMemo, useRef, useState } from 'react'
import { addCut, detectFillerWords, detectSilences, normalizeCuts, removeCut } from '../services/cuts'
import { getKeptRanges } from '../remotion/segments'
import CutAudioPlayer from '../components/CutAudioPlayer'
import Waveform from '../components/Waveform'
import { useCutAudioPlayback } from '../components/useCutAudioPlayback'
import type { Project } from '../types'
import './CutTab.css'

type Props = {
  project: Project
  onProjectChange: (updater: (p: Project) => Project) => void
}

type Selection = { startIdx: number; endIdx: number }

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDuration(ms: number): string {
  const s = ms / 1000
  return s < 10 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`
}

// A simple Descript-inspired cut editor: click (or drag across) words to select them, delete the
// selection to cut that time out of the narration, drag the two handles below to trim the start
// and end, and "Remove silence" auto-cuts long gaps between words. Cuts are stored as time
// ranges (project.cuts) rather than re-encoding the audio — the render pipeline (see
// remotion/segments.ts + Composition.tsx) skips those ranges when building the timeline.
export default function CutTab({ project, onProjectChange }: Props) {
  const [selection, setSelection] = useState<Selection | null>(null)
  const dragStartIdx = useRef<number | null>(null)

  const totalMs = project.audioDurationMs || 1
  const keptRanges = useMemo(() => getKeptRanges(project), [project])
  const cuts = useMemo(() => normalizeCuts(project.cuts), [project.cuts])
  const { audioRef, isPlaying, origMs, outMs, totalOutMs, toggle, seekOrig } = useCutAudioPlayback(keptRanges)

  const isWordCut = useCallback((wordStartMs: number) => {
    return !keptRanges.some((r) => wordStartMs >= r.origStart && wordStartMs < r.origEnd)
  }, [keptRanges])

  const setCuts = useCallback((next: (typeof project.cuts)) => {
    onProjectChange((p) => ({ ...p, cuts: next }))
  }, [onProjectChange])

  const handleWordDown = (i: number) => {
    dragStartIdx.current = i
    setSelection({ startIdx: i, endIdx: i })
  }

  const handleWordEnter = (i: number) => {
    if (dragStartIdx.current === null) return
    setSelection({ startIdx: Math.min(dragStartIdx.current, i), endIdx: Math.max(dragStartIdx.current, i) })
  }

  const handleWordUp = () => {
    dragStartIdx.current = null
  }

  // Clicking a word (cut or not) jumps the waveform/audio playhead there — a quick way to
  // scrub to a specific point while reading, not just a "restore this cut" action.
  const handleWordClick = (i: number, wordStartMs: number) => {
    seekOrig(wordStartMs)
    if (isWordCut(wordStartMs)) {
      const covering = cuts.find((c) => wordStartMs >= c.startMs && wordStartMs < c.endMs)
      if (covering) setCuts(removeCut(project.cuts, covering.id))
      setSelection(null)
    }
  }

  const deleteSelection = useCallback(() => {
    if (!selection) return
    const words = project.words
    const from = words[selection.startIdx]?.startMs
    const to = words[selection.endIdx]?.endMs
    if (from === undefined || to === undefined) return
    setCuts(addCut(project.cuts, from, to))
    setSelection(null)
  }, [selection, project.words, project.cuts, setCuts])

  const removeSilence = useCallback(() => {
    const silences = detectSilences(project.words, totalMs)
    setCuts(normalizeCuts([...project.cuts, ...silences]))
  }, [project.words, project.cuts, totalMs, setCuts])

  const removeFillerWords = useCallback(() => {
    const filler = detectFillerWords(project.words)
    setCuts(normalizeCuts([...project.cuts, ...filler]))
  }, [project.words, project.cuts, setCuts])

  // Trim = a cut anchored at the very start (0) or very end (totalMs) of the clip.
  const leadingCut = cuts.find((c) => c.startMs <= 0)
  const trailingCut = cuts.find((c) => c.endMs >= totalMs)
  const trimStartMs = leadingCut?.endMs ?? 0
  const trimEndMs = trailingCut?.startMs ?? totalMs

  const setTrim = useCallback((side: 'left' | 'right', ms: number) => {
    const clamped = Math.max(0, Math.min(totalMs, ms))
    let next = project.cuts
    if (side === 'left') {
      if (leadingCut) next = removeCut(next, leadingCut.id)
      if (clamped > 0) next = addCut(next, 0, clamped)
    } else {
      if (trailingCut) next = removeCut(next, trailingCut.id)
      if (clamped < totalMs) next = addCut(next, clamped, totalMs)
    }
    setCuts(next)
  }, [project.cuts, leadingCut, trailingCut, totalMs, setCuts])

  const removedMs = totalMs - keptRanges.reduce((sum, r) => sum + (r.outEnd - r.outStart), 0)

  if (!project.audioUrl) {
    return (
      <div className="cut-tab cut-tab--empty">
        <p>Record or import a narration clip first, on the "Record / Import / Transcribe" tab.</p>
      </div>
    )
  }

  return (
    <div className="cut-tab" onPointerUp={handleWordUp}>
      <audio ref={audioRef} src={project.audioUrl} preload="auto" />

      <div className="cut-tab__transcript-panel">
        <label className="cut-tab__transcript-label">Transcript</label>
        <div className="cut-tab__words" onMouseLeave={() => { dragStartIdx.current = null }}>
          {project.words.map((w, i) => {
            const cut = isWordCut(w.startMs)
            const selected = selection && i >= selection.startIdx && i <= selection.endIdx
            // Whisper's word timestamps carry real punctuation (see services/wordAlign.ts's
            // punctuateWords) — a word ending a sentence gets a line break after it, so this
            // reads as short lines instead of one unbroken wall of text.
            const endsSentence = /[.!?]$/.test(w.text)
            return (
              <span key={i}>
                <span
                  className={`cut-tab__word ${cut ? 'cut-tab__word--cut' : ''} ${selected ? 'cut-tab__word--selected' : ''}`}
                  onMouseDown={() => !cut && handleWordDown(i)}
                  onMouseEnter={() => handleWordEnter(i)}
                  onClick={() => handleWordClick(i, w.startMs)}
                  title={cut ? 'Click to restore' : undefined}
                >
                  {w.text}
                </span>
                {' '}
                {endsSentence && <br />}
              </span>
            )
          })}
        </div>
      </div>

      <div className="cut-tab__audio-panel">
        <div className="cut-tab__toolbar">
          <button type="button" className="cut-tab__btn" onClick={removeSilence}>Remove silence</button>
          <button type="button" className="cut-tab__btn" onClick={removeFillerWords}>Remove filler words</button>
          <button type="button" className="cut-tab__btn cut-tab__btn--primary" disabled={!selection} onClick={deleteSelection}>
            Delete selected
          </button>
        </div>

        <Waveform
          audioUrl={project.audioUrl}
          totalMs={totalMs}
          trimStartMs={trimStartMs}
          trimEndMs={trimEndMs}
          playheadMs={origMs}
          cuts={cuts}
          onTrimStart={(ms) => setTrim('left', ms)}
          onTrimEnd={(ms) => setTrim('right', ms)}
          onSeek={seekOrig}
        />

        <CutAudioPlayer isPlaying={isPlaying} outMs={outMs} totalOutMs={totalOutMs} onToggle={toggle} />

        <div className="cut-tab__info">
          <div className="cut-tab__summary">
            {formatDuration(removedMs)} removed · {formatDuration(totalMs - removedMs)} remaining of {formatDuration(totalMs)}
          </div>
          {cuts.length > 0 && (
            <div className="cut-tab__cuts-list">
              {cuts.map((c) => (
                <div key={c.id} className="cut-tab__cut-chip">
                  <span>{formatTime(c.startMs)}–{formatTime(c.endMs)} ({formatDuration(c.endMs - c.startMs)})</span>
                  <button type="button" onClick={() => setCuts(removeCut(project.cuts, c.id))} title="Undo this cut">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

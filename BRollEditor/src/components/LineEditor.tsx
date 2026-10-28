import { Fragment, useEffect, useRef, useState } from 'react'
import { alignTextToWords } from '../services/wordAlign'
import type { Delay, Line, Word } from '../types'
import './LineEditor.css'

type Props = {
  words: Word[]
  lines: Line[]
  activeLineId: string | null
  delays: Delay[]
  selectedLineIds: Set<string>
  onToggleLineSelection: (lineId: string) => void
  onLinesChange: (lines: Line[]) => void
  onSearch: (lineId: string) => void
  onToggleKenBurns: (lineId: string) => void
  onClear: (lineId: string) => void
  onSeek: (lineId: string) => void
  onAddDelay: (afterLineId: string) => void
  onUpdateDelay: (delayId: string, durationMs: number) => void
  onRemoveDelay: (delayId: string) => void
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

// One editable row per transcript line, with that line's b-roll controls to its right and a
// divider below — a single unified "one row per scene" editor, replacing a separate textarea +
// separate thumbnail list. The canonical edit buffer is still the full joined text (realigned
// against the original word timestamps via alignTextToWords, same as before); this component
// just presents it as per-line rows and turns Enter/Backspace-at-start into split/merge of that
// text instead of leaving them to insert/remove characters within a single big textarea.
export default function LineEditor({ words, lines, activeLineId, delays, selectedLineIds, onToggleLineSelection, onLinesChange, onSearch, onToggleKenBurns, onClear, onSeek, onAddDelay, onUpdateDelay, onRemoveDelay }: Props) {
  const [rows, setRows] = useState<string[]>(() => lines.map((l) => l.text))
  const lastAppliedRef = useRef<string[]>(rows)
  const debounceRef = useRef<number | null>(null)
  const textareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({})

  // Keep rows in sync if lines change from outside (e.g. a fresh transcription).
  useEffect(() => {
    const external = lines.map((l) => l.text)
    if (JSON.stringify(external) !== JSON.stringify(lastAppliedRef.current)) {
      setRows(external)
      lastAppliedRef.current = external
      requestAnimationFrame(() => {
        Object.values(textareaRefs.current).forEach(autoGrow)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words])

  const commit = (nextRows: string[]) => {
    setRows(nextRows)
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      lastAppliedRef.current = nextRows
      const fullText = nextRows.join('\n')
      const realigned = alignTextToWords(fullText, words)
      // Carry over each line's b-roll selection by index — edits to wording/line breaks
      // shouldn't lose a selection unless lines are actually inserted/removed.
      const merged = realigned.map((line, i) => ({ ...line, broll: lines[i]?.broll ?? null }))
      onLinesChange(merged)
    }, 400)
  }

  const handleChange = (i: number, value: string) => {
    const next = [...rows]
    next[i] = value
    commit(next)
    requestAnimationFrame(() => autoGrow(textareaRefs.current[i]))
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const pos = ta.selectionStart
      const value = rows[i]
      const next = [...rows]
      next.splice(i, 1, value.slice(0, pos), value.slice(pos))
      commit(next)
      requestAnimationFrame(() => {
        const el = textareaRefs.current[i + 1]
        el?.focus()
        el?.setSelectionRange(0, 0)
        autoGrow(el)
      })
    } else if (e.key === 'Backspace' && ta.selectionStart === 0 && ta.selectionEnd === 0 && i > 0) {
      e.preventDefault()
      const prevLen = rows[i - 1].length
      const merged = rows[i - 1] + rows[i]
      const next = [...rows]
      next.splice(i - 1, 2, merged)
      commit(next)
      requestAnimationFrame(() => {
        const el = textareaRefs.current[i - 1]
        el?.focus()
        el?.setSelectionRange(prevLen, prevLen)
        autoGrow(el)
      })
    }
  }

  return (
    <div className="line-editor">
      {rows.map((text, i) => {
        const line = lines[i]
        const isActive = !!line && line.id === activeLineId
        const delay = line ? delays.find((d) => d.afterLineId === line.id) : undefined
        const isLastRow = i === rows.length - 1
        return (
          <Fragment key={line?.id ?? i}>
          <div className={`line-editor__row ${isActive ? 'line-editor__row--active' : ''}`}>
            {line && (
              <input
                type="checkbox"
                className="line-editor__select"
                checked={selectedLineIds.has(line.id)}
                onChange={() => onToggleLineSelection(line.id)}
                title="Select this scene"
                aria-label="Select this scene"
              />
            )}
            <button
              type="button"
              className="line-editor__thumb"
              onClick={() => line && onSearch(line.id)}
              title="Search b-roll for this line"
            >
              {line?.broll?.type === 'color' ? (
                <span className="line-editor__thumb-swatch" style={{ backgroundColor: line.broll.url }} />
              ) : line?.broll ? (
                <img src={line.broll.thumbnailUrl} alt="" />
              ) : (
                <span className="line-editor__thumb-placeholder">+</span>
              )}
              {line?.broll?.type === 'video' && <span className="line-editor__badge">▶</span>}
            </button>

            <textarea
              ref={(el) => {
                textareaRefs.current[i] = el
                if (el) autoGrow(el)
              }}
              className="line-editor__text"
              value={text}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onFocus={() => line && onSeek(line.id)}
              placeholder="Type or paste your narration here…"
              rows={1}
              spellCheck={false}
            />

            <div className="line-editor__side">
              {line && <span className="line-editor__time">{formatTime(line.startMs)}–{formatTime(line.endMs)}</span>}
              {line?.broll?.type === 'image' && (
                <label className="line-editor__kenburns">
                  <input type="checkbox" checked={line.broll.kenBurns} onChange={() => onToggleKenBurns(line.id)} />
                  Motion
                </label>
              )}
              {line?.broll ? (
                <>
                  <button type="button" className="line-editor__icon-btn" onClick={() => onSearch(line.id)} title="Change b-roll" aria-label="Change b-roll">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10" />
                      <polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                  </button>
                  <button type="button" className="line-editor__icon-btn line-editor__icon-btn--ghost" onClick={() => onClear(line.id)} title="Remove b-roll" aria-label="Remove b-roll">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </>
              ) : (
                line && <button type="button" className="line-editor__btn line-editor__btn--primary" onClick={() => onSearch(line.id)}>Add b-roll</button>
              )}
            </div>
          </div>

          {line && !isLastRow && (
            <div className="line-editor__gap">
              {delay ? (
                <div className="line-editor__delay-chip">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={Math.round(delay.durationMs) / 1000}
                    onChange={(e) => {
                      const seconds = Number(e.target.value)
                      if (Number.isFinite(seconds)) onUpdateDelay(delay.id, Math.max(0, Math.round(seconds * 1000)))
                    }}
                  />
                  <span>s hold</span>
                  <button type="button" onClick={() => onRemoveDelay(delay.id)} title="Remove delay" aria-label="Remove delay">×</button>
                </div>
              ) : (
                <button type="button" className="line-editor__gap-add" onClick={() => onAddDelay(line.id)}>
                  + Add delay
                </button>
              )}
            </div>
          )}
          </Fragment>
        )
      })}
    </div>
  )
}

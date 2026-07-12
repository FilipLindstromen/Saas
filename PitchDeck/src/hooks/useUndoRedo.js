import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * Undo/redo history for deck editor state snapshots.
 * @param {object} currentState - Latest { slides, selectedSlideId, chapters, currentChapterId, settings, recordSettings }
 * @param {(snapshot: object) => void} restoreState - Apply a history snapshot to React state
 */
export function useUndoRedo(currentState, restoreState) {
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const historyIndexRef = useRef(-1)
  const initialPushed = useRef(false)

  useEffect(() => {
    historyIndexRef.current = historyIndex
  }, [historyIndex])

  useEffect(() => {
    if (initialPushed.current) return
    initialPushed.current = true
    setHistory([currentState])
    setHistoryIndex(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveToHistory = useCallback((stateSnapshot) => {
    const state = stateSnapshot ?? currentState
    setHistory((prevHistory) => {
      const idx = historyIndexRef.current
      const newHistory = [...prevHistory.slice(0, idx + 1), state]
      const newIndex = idx + 1
      historyIndexRef.current = newIndex
      setHistoryIndex(newIndex)
      return newHistory
    })
  }, [currentState])

  const resetHistory = useCallback((stateSnapshot) => {
    const state = stateSnapshot ?? currentState
    initialPushed.current = true
    historyIndexRef.current = 0
    setHistory([state])
    setHistoryIndex(0)
  }, [currentState])

  const undo = useCallback(() => {
    if (historyIndex <= 0) return
    const prevIndex = historyIndex - 1
    const prevState = history[prevIndex]
    setHistoryIndex(prevIndex)
    restoreState(prevState)
  }, [history, historyIndex, restoreState])

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return
    const nextIndex = historyIndex + 1
    const nextState = history[nextIndex]
    setHistoryIndex(nextIndex)
    restoreState(nextState)
  }, [history, historyIndex, restoreState])

  return {
    history,
    historyIndex,
    saveToHistory,
    resetHistory,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1 && history.length > 0,
  }
}

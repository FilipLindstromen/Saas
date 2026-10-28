import { useState, useRef, useCallback, useEffect } from 'react'
import './AudioRecorder.css'

type Props = {
  onRecorded: (blob: Blob) => void
  onError: (message: string) => void
  disabled?: boolean
  /** Button text while idle (default "Record"). */
  label?: string
  /** Hides the microphone picker row for a smaller footprint — still uses the default mic. */
  compact?: boolean
}

export default function AudioRecorder({ onRecorded, onError, disabled, label = 'Record', compact = false }: Props) {
  const [isRecording, setIsRecording] = useState(false)
  const [microphones, setMicrophones] = useState<{ deviceId: string; label: string }[]>([])
  const [selectedMicId, setSelectedMicId] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const cancelRequestedRef = useRef(false)

  const refreshMicrophones = useCallback(async (requestPermission = false) => {
    try {
      if (requestPermission) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((t) => t.stop())
      }
      const devices = await navigator.mediaDevices.enumerateDevices()
      const mics = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 8)}` }))
      setMicrophones(mics)
      if (mics.length > 0 && !selectedMicId) setSelectedMicId(mics[0].deviceId)
    } catch (err: any) {
      onError?.(err?.message || 'Could not list microphones.')
    }
  }, [onError, selectedMicId])

  useEffect(() => {
    refreshMicrophones(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isRecording || !streamRef.current || !canvasRef.current) return
    const stream = streamRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    const audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8
    source.connect(analyser)
    analyserRef.current = analyser
    audioContextRef.current = audioContext

    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    const w = canvas.width
    const h = canvas.height

    function draw() {
      const a = analyserRef.current
      if (!a) return
      a.getByteTimeDomainData(dataArray)
      ctx.fillStyle = 'rgba(0,0,0,0)'
      ctx.clearRect(0, 0, w, h)
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#ff6b35'
      ctx.lineWidth = 2
      ctx.beginPath()
      const sliceWidth = w / dataArray.length
      let x = 0
      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128
        const y = (v * h) / 2 + h / 2
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        x += sliceWidth
      }
      ctx.lineTo(w, h / 2)
      ctx.stroke()
      rafIdRef.current = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
      analyserRef.current = null
      try { audioContext.close() } catch { /* noop */ }
      audioContextRef.current = null
    }
  }, [isRecording])

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current
    if (mr && mr.state !== 'inactive') mr.stop()
    setIsRecording(false)
  }, [])

  const cancelRecording = useCallback(() => {
    cancelRequestedRef.current = true
    const mr = mediaRecorderRef.current
    if (mr && mr.state !== 'inactive') mr.stop()
    setIsRecording(false)
  }, [])

  const startRecording = useCallback(async () => {
    onError?.('')
    if (microphones.length === 0) {
      onError?.('No microphone found. Please allow microphone access and try again.')
      await refreshMicrophones(true)
      return
    }
    try {
      const audioConstraints: MediaStreamConstraints = selectedMicId
        ? { audio: { deviceId: { exact: selectedMicId } } }
        : { audio: true }
      const stream = await navigator.mediaDevices.getUserMedia(audioConstraints)
      streamRef.current = stream
      chunksRef.current = []

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mr.onstop = () => {
        const stream = streamRef.current
        if (stream) {
          stream.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }
        if (cancelRequestedRef.current) {
          cancelRequestedRef.current = false
          chunksRef.current = []
          return
        }
        const blob = new Blob(chunksRef.current, { type: mimeType })
        chunksRef.current = []
        if (blob.size < 1000) {
          onError?.('Recording too short. Please try again.')
          return
        }
        onRecorded(blob)
      }

      mr.start(200)
      setIsRecording(true)
    } catch (err: any) {
      onError?.(err?.message || 'Could not access microphone.')
      if (err?.name === 'NotAllowedError') await refreshMicrophones(true)
    }
  }, [onRecorded, onError, microphones.length, selectedMicId, refreshMicrophones])

  const handleToggle = useCallback(() => {
    if (isRecording) stopRecording()
    else startRecording()
  }, [isRecording, startRecording, stopRecording])

  const canRecord = microphones.length > 0 && (selectedMicId || microphones.length === 1)

  return (
    <div className="audio-recorder">
      {!compact && (
        <div className="audio-recorder__mic-row">
          <label className="audio-recorder__mic-label" htmlFor="broll-mic">Microphone</label>
          <select
            id="broll-mic"
            className="audio-recorder__mic-select"
            value={selectedMicId}
            onChange={(e) => setSelectedMicId(e.target.value)}
            disabled={isRecording || disabled}
          >
            {microphones.length === 0 && <option value="">No microphones — allow access</option>}
            {microphones.map((mic) => (
              <option key={mic.deviceId} value={mic.deviceId}>{mic.label}</option>
            ))}
          </select>
          <button
            type="button"
            className="audio-recorder__refresh"
            onClick={() => refreshMicrophones(true)}
            disabled={isRecording || disabled}
            title="Refresh microphone list"
            aria-label="Refresh microphone list"
          >
            ↻
          </button>
        </div>
      )}

      {isRecording && (
        <div className="audio-recorder__waveform">
          <canvas ref={canvasRef} width={320} height={56} aria-hidden="true" />
        </div>
      )}

      <div className="audio-recorder__actions">
        <button
          type="button"
          className={`audio-recorder__btn ${isRecording ? 'audio-recorder__btn--stop' : ''}`}
          onClick={handleToggle}
          disabled={disabled || !canRecord}
        >
          {isRecording ? (
            <>
              <span className="audio-recorder__pulse" />
              <span>Stop recording</span>
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              <span>{label}</span>
            </>
          )}
        </button>
        {isRecording && (
          <button type="button" className="audio-recorder__btn audio-recorder__btn--cancel" onClick={cancelRecording}>
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

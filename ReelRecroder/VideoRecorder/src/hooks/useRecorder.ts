import { useState, useRef, useCallback, useEffect } from 'react'

export interface UseRecorderOptions {
  /** Prefer this stream (canvas with overlays); recorder starts when this is set */
  canvasStream: MediaStream | null
  /** Fallback if canvas never becomes available */
  videoStream: MediaStream | null
  audioStream: MediaStream | null
  videoBitrate?: number
}

function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return 'video/webm'
}

export function useRecorder({
  canvasStream,
  videoStream,
  audioStream,
  videoBitrate = 5_000_000,
}: UseRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recorderRef = useRef<MediaRecorder | null>(null)
  const mimeTypeRef = useRef('')

  const startRecording = useCallback(() => {
    setError(null)
    setRecordedBlob(null)
    chunksRef.current = []
    setIsRecording(true)
  }, [])

  useEffect(() => {
    if (!isRecording || recorderRef.current) return

    const startWithStream = (source: MediaStream) => {
      if (recorderRef.current) return
      if (source.getVideoTracks().length === 0) return
      const stream = source.clone()
      if (audioStream) {
        audioStream.getAudioTracks().forEach((t) => stream.addTrack(t.clone()))
      }
      const mimeType = getSupportedMimeType()
      mimeTypeRef.current = mimeType
      const options: MediaRecorderOptions = {
        mimeType,
        videoBitsPerSecond: videoBitrate,
        audioBitsPerSecond: 128_000,
      }
      try {
        const recorder = new MediaRecorder(stream, options)
        recorder.ondataavailable = (e) => {
          if (e.data.size) chunksRef.current.push(e.data)
        }
        recorder.onstop = () => {
          if (chunksRef.current.length) {
            setRecordedBlob(new Blob(chunksRef.current, { type: mimeTypeRef.current }))
          }
          stream.getTracks().forEach((t) => t.stop())
        }
        recorder.onerror = () => setError('Recording failed')
        recorder.start(200)
        recorderRef.current = recorder
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start recording')
        setIsRecording(false)
      }
    }

    if (canvasStream && canvasStream.getVideoTracks().length > 0) {
      startWithStream(canvasStream)
      return
    }
    if (videoStream && videoStream.getVideoTracks().length > 0) {
      const id = setTimeout(() => {
        if (recorderRef.current) return
        if (canvasStream && canvasStream.getVideoTracks().length > 0) {
          startWithStream(canvasStream)
        } else {
          startWithStream(videoStream)
        }
      }, 350)
      return () => clearTimeout(id)
    }
  }, [isRecording, canvasStream, videoStream, audioStream, videoBitrate])

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current
    if (rec) {
      try {
        if (rec.state === 'recording') {
          rec.requestData()
        }
        rec.stop()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to stop recording')
      }
      recorderRef.current = null
    }
    setIsRecording(false)
  }, [])

  return { isRecording, recordedBlob, error, startRecording, stopRecording, setRecordedBlob }
}

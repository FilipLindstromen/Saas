import { useState, useEffect, useCallback } from 'react'

export interface MediaDeviceInfo {
  deviceId: string
  label: string
  kind: 'videoinput' | 'audioinput' | 'audiooutput'
}

export function useMediaDevices() {
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      setVideoDevices(
        devices
          .filter((d) => d.kind === 'videoinput')
          .map((d) => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 8)}`, kind: d.kind }))
      )
      setAudioDevices(
        devices
          .filter((d) => d.kind === 'audioinput')
          .map((d) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`, kind: d.kind }))
      )
    } catch (e) {
      setError('Could not enumerate devices')
    }
  }, [])

  useEffect(() => {
    load()
    navigator.mediaDevices.addEventListener('devicechange', load)
    return () => navigator.mediaDevices.removeEventListener('devicechange', load)
  }, [load])

  return { videoDevices, audioDevices, error, refresh: load }
}

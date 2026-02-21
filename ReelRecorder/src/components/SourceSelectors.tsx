import { useState } from 'react'
import type { MediaDeviceInfo } from '../hooks/useMediaDevices'
import type { VideoSourceKind } from '../types'
import styles from './SourceSelectors.module.css'

interface SourceSelectorsProps {
  videoDevices: MediaDeviceInfo[]
  audioDevices: MediaDeviceInfo[]
  videoKind: VideoSourceKind
  onVideoKindChange: (k: VideoSourceKind) => void
  videoDeviceId: string
  onVideoDeviceIdChange: (id: string) => void
  audioDeviceId: string
  onAudioDeviceIdChange: (id: string) => void
  error: string | null
  onConnect?: () => void | Promise<void>
  hasStream?: boolean
}

export function SourceSelectors({
  videoDevices,
  audioDevices,
  videoKind,
  onVideoKindChange,
  videoDeviceId,
  onVideoDeviceIdChange,
  audioDeviceId,
  onAudioDeviceIdChange,
  error,
  onConnect,
  hasStream = false,
}: SourceSelectorsProps) {
  const [connecting, setConnecting] = useState(false)

  const handleConnect = async () => {
    if (!onConnect || connecting) return
    setConnecting(true)
    try {
      await onConnect()
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className={styles.wrap}>
      {!hasStream && onConnect && (
        <button
          type="button"
          className={styles.connectBtn}
          onClick={handleConnect}
          disabled={connecting}
        >
          {connecting ? 'Connecting…' : videoKind === 'screen' ? 'Connect screen' : 'Connect camera'}
        </button>
      )}
      {error && <p className={styles.error}>{error}</p>}
      <div className={`${styles.row} ${styles.rowInline}`}>
        <label className={styles.label}>Video source</label>
        <select
          className={styles.select}
          value={videoKind}
          onChange={(e) => onVideoKindChange(e.target.value as VideoSourceKind)}
        >
          <option value="camera">Camera</option>
          <option value="screen">Screen</option>
        </select>
      </div>
      {videoKind === 'camera' && (
        <div className={styles.row}>
          <label className={styles.label}>Camera</label>
          <select
            className={styles.select}
            value={videoDeviceId}
            onChange={(e) => onVideoDeviceIdChange(e.target.value)}
            title={videoDevices.find((d) => d.deviceId === videoDeviceId)?.label}
          >
            {videoDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className={styles.row}>
        <label className={styles.label}>Microphone</label>
        <select
          className={styles.select}
          value={audioDeviceId}
          onChange={(e) => onAudioDeviceIdChange(e.target.value)}
          title={audioDevices.find((d) => d.deviceId === audioDeviceId)?.label}
        >
          {audioDevices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

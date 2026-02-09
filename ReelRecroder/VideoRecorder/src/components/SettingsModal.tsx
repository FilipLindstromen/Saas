import { useState, useEffect } from 'react'
import { IconX, IconCheck } from './Icons'
import { getYouTubeAccessToken, fetchYouTubeChannels } from '../services/youtubeUpload'
import styles from './SettingsModal.module.css'

const OPENAI_KEY_STORAGE = 'videoRecorder_openaiApiKey'
const GOOGLE_CLIENT_ID_STORAGE = 'videoRecorder_googleClientId'
const YOUTUBE_CHANNEL_ID_STORAGE = 'videoRecorder_youtubeChannelId'
const YOUTUBE_CHANNEL_TITLE_STORAGE = 'videoRecorder_youtubeChannelTitle'

export function getStoredOpenAIKey(): string {
  if (typeof window === 'undefined' || !window.localStorage) return ''
  return window.localStorage.getItem(OPENAI_KEY_STORAGE) ?? ''
}

export function setStoredOpenAIKey(value: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  if (value) {
    window.localStorage.setItem(OPENAI_KEY_STORAGE, value)
  } else {
    window.localStorage.removeItem(OPENAI_KEY_STORAGE)
  }
}

export function getStoredGoogleClientId(): string {
  if (typeof window === 'undefined' || !window.localStorage) return ''
  return window.localStorage.getItem(GOOGLE_CLIENT_ID_STORAGE) ?? ''
}

export function setStoredGoogleClientId(value: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  if (value) {
    window.localStorage.setItem(GOOGLE_CLIENT_ID_STORAGE, value.trim())
  } else {
    window.localStorage.removeItem(GOOGLE_CLIENT_ID_STORAGE)
  }
}

export function getStoredYouTubeChannel(): { id: string; title: string } | null {
  if (typeof window === 'undefined' || !window.localStorage) return null
  const id = window.localStorage.getItem(YOUTUBE_CHANNEL_ID_STORAGE)
  const title = window.localStorage.getItem(YOUTUBE_CHANNEL_TITLE_STORAGE)
  return id && title ? { id, title } : null
}

function setStoredYouTubeChannel(channel: { id: string; title: string } | null): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  if (channel) {
    window.localStorage.setItem(YOUTUBE_CHANNEL_ID_STORAGE, channel.id)
    window.localStorage.setItem(YOUTUBE_CHANNEL_TITLE_STORAGE, channel.title)
  } else {
    window.localStorage.removeItem(YOUTUBE_CHANNEL_ID_STORAGE)
    window.localStorage.removeItem(YOUTUBE_CHANNEL_TITLE_STORAGE)
  }
}

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onApiKeyChange: (key: string) => void
}

export function SettingsModal({ isOpen, onClose, onApiKeyChange }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState('')
  const [googleClientId, setGoogleClientId] = useState('')
  const [youtubeChannel, setYoutubeChannel] = useState<{ id: string; title: string } | null>(null)
  const [youtubeConnecting, setYoutubeConnecting] = useState(false)
  const [youtubeError, setYoutubeError] = useState<string | null>(null)
  const [originCopied, setOriginCopied] = useState(false)

  const appOrigin = typeof window !== 'undefined' ? window.location.origin : ''

  const copyOrigin = () => {
    if (!appOrigin) return
    navigator.clipboard.writeText(appOrigin).then(() => {
      setOriginCopied(true)
      setTimeout(() => setOriginCopied(false), 2000)
    })
  }

  useEffect(() => {
    if (isOpen) {
      setApiKey(getStoredOpenAIKey())
      setGoogleClientId(getStoredGoogleClientId())
      setYoutubeChannel(getStoredYouTubeChannel())
      setYoutubeError(null)
    }
  }, [isOpen])

  const handleConnectYouTube = async () => {
    const clientId = getStoredGoogleClientId() || googleClientId.trim()
    if (!clientId) {
      setYoutubeError('Enter and save Google Client ID first.')
      return
    }
    setYoutubeError(null)
    setYoutubeConnecting(true)
    try {
      const token = await getYouTubeAccessToken(clientId)
      const channels = await fetchYouTubeChannels(token)
      if (channels.length === 0) {
        setYoutubeError('No YouTube channel found for this account.')
        return
      }
      const channel = channels[0]
      setStoredYouTubeChannel(channel)
      setYoutubeChannel(channel)
    } catch (e) {
      setYoutubeError(e instanceof Error ? e.message : 'Connection failed')
    } finally {
      setYoutubeConnecting(false)
    }
  }

  const handleDisconnectYouTube = () => {
    setStoredYouTubeChannel(null)
    setYoutubeChannel(null)
    setYoutubeError(null)
  }

  const handleSave = () => {
    setStoredOpenAIKey(apiKey.trim())
    setStoredGoogleClientId(googleClientId)
    onApiKeyChange(apiKey.trim())
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Settings">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Settings</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>
        <div className={styles.body}>
          <label className={styles.label}>
            OpenAI API key
            <span className={styles.hint}>Used for burn-in captions (Whisper) and YouTube description. Stored only in your browser.</span>
          </label>
          <input
            type="password"
            className={styles.input}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            autoComplete="off"
          />
          <label className={styles.label}>
            Google Client ID (for YouTube upload)
            <span className={styles.hint}>Optional. From Google Cloud Console: create OAuth 2.0 Client ID (Web application), add your site to Authorized JavaScript origins, then paste the Client ID here.</span>
          </label>
          <input
            type="text"
            className={styles.input}
            value={googleClientId}
            onChange={(e) => setGoogleClientId(e.target.value)}
            placeholder="xxxxx.apps.googleusercontent.com"
            autoComplete="off"
          />
          <div className={styles.oauthSetup} aria-label="OAuth redirect_uri_mismatch fix">
            <p className={styles.oauthTitle}>Fix <strong>Error 400: redirect_uri_mismatch</strong></p>
            <ol className={styles.oauthSteps}>
              <li>In Google Cloud Console use OAuth client type <strong>Web application</strong> (not Desktop).</li>
              <li>This app uses the browser JS flow, so add your origin under <strong>Authorized JavaScript origins</strong> (not Redirect URIs). It must match exactly: <code>http</code> vs <code>https</code>, port (e.g. <code>:5173</code>), no trailing slash.</li>
              <li>Add this exact origin (copy and paste into Authorized JavaScript origins):</li>
            </ol>
            <div className={styles.originRow}>
              <code className={styles.originCode}>{appOrigin || '—'}</code>
              {appOrigin && (
                <button
                  type="button"
                  className={styles.copyOriginBtn}
                  onClick={copyOrigin}
                  aria-label="Copy origin"
                >
                  {originCopied ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
            <p className={styles.originNote}>For local dev use the URL you actually open (e.g. <code>http://localhost:5173</code>). <code>localhost</code> and <code>127.0.0.1</code> are different—add the one you use.</p>
          </div>
          <section className={styles.youtubeSection}>
            <label className={styles.label}>
              YouTube account & channel
              <span className={styles.hint}>Connect to verify upload access and set the channel used for uploads.</span>
            </label>
            {youtubeChannel ? (
              <div className={styles.youtubeConnected}>
                <span className={styles.youtubeChannelName}>Connected: {youtubeChannel.title}</span>
                <button
                  type="button"
                  className={styles.disconnectBtn}
                  onClick={handleDisconnectYouTube}
                  aria-label="Disconnect YouTube account"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className={styles.connectBtn}
                  onClick={handleConnectYouTube}
                  disabled={youtubeConnecting || !googleClientId.trim()}
                  aria-label="Connect YouTube account"
                >
                  {youtubeConnecting ? 'Connecting…' : 'Connect YouTube account'}
                </button>
                {!googleClientId.trim() && (
                  <span className={styles.hint}>Save Google Client ID above first, then connect.</span>
                )}
              </>
            )}
            {youtubeError && <p className={styles.error}>{youtubeError}</p>}
          </section>
        </div>
        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose} title="Cancel" aria-label="Cancel">
            <IconX />
          </button>
          <button type="button" className={styles.saveBtn} onClick={handleSave} title="Save" aria-label="Save">
            <IconCheck />
          </button>
        </div>
      </div>
    </div>
  )
}

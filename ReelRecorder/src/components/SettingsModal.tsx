import { useState, useEffect } from 'react'
import { IconX, IconCheck } from './Icons'
import { getYouTubeAccessToken, fetchYouTubeChannels } from '../services/youtubeUpload'
import { loadApiKeys } from '../utils/apiKeys'
import styles from './SettingsModal.module.css'

const YOUTUBE_CHANNEL_ID_STORAGE = 'videoRecorder_youtubeChannelId'
const YOUTUBE_CHANNEL_TITLE_STORAGE = 'videoRecorder_youtubeChannelTitle'

export function getStoredOpenAIKey(): string {
  return loadApiKeys().openai ?? ''
}

export function getStoredGoogleClientId(): string {
  return loadApiKeys().googleClientId ?? ''
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

export function getStoredUnsplashAccessKey(): string {
  return loadApiKeys().unsplash ?? ''
}

export function getStoredPexelsApiKey(): string {
  return loadApiKeys().pexels ?? ''
}

export function getStoredPixabayApiKey(): string {
  return loadApiKeys().pixabay ?? ''
}

export function getStoredGiphyApiKey(): string {
  return loadApiKeys().giphy ?? ''
}

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onApiKeyChange?: (key: string) => void
}

export function SettingsModal({ isOpen, onClose, onApiKeyChange }: SettingsModalProps) {
  const [youtubeChannel, setYoutubeChannel] = useState<{ id: string; title: string } | null>(null)
  const [youtubeConnecting, setYoutubeConnecting] = useState(false)
  const [youtubeError, setYoutubeError] = useState<string | null>(null)
  const [originCopied, setOriginCopied] = useState(false)

  const appOrigin = typeof window !== 'undefined' ? window.location.origin : ''
  const saasAppsUrl = typeof window !== 'undefined'
    ? new URL('../index.html', window.location.href).href
    : '/index.html'

  const copyOrigin = () => {
    if (!appOrigin) return
    navigator.clipboard.writeText(appOrigin).then(() => {
      setOriginCopied(true)
      setTimeout(() => setOriginCopied(false), 2000)
    })
  }

  useEffect(() => {
    if (isOpen) {
      setYoutubeChannel(getStoredYouTubeChannel())
      setYoutubeError(null)
    }
  }, [isOpen])

  const handleConnectYouTube = async () => {
    const clientId = getStoredGoogleClientId()
    if (!clientId) {
      setYoutubeError('Add Google Client ID in the SaaS Apps screen first.')
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
    // Google Client ID is stored in the shared SaaS API keys - user must configure in SaaS apps screen
    // For now we only support reading; editing happens in docs/index.html
    onApiKeyChange?.(getStoredOpenAIKey())
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
          <p className={styles.apiKeysHint}>
            API keys (OpenAI, GIPHY, Pexels, Pixabay, Unsplash) are configured in the{' '}
            <a href={saasAppsUrl} target="_blank" rel="noopener noreferrer" className={styles.apiKeysLink}>
              SaaS Apps screen
            </a>
            . They are shared across all apps.
          </p>
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
              <span className={styles.hint}>Connect to verify upload access and set the channel used for uploads. Configure Google Client ID in the SaaS Apps screen.</span>
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
                  disabled={youtubeConnecting || !getStoredGoogleClientId().trim()}
                  aria-label="Connect YouTube account"
                >
                  {youtubeConnecting ? 'Connecting…' : 'Connect YouTube account'}
                </button>
                {!getStoredGoogleClientId().trim() && (
                  <span className={styles.hint}>Add Google Client ID in the SaaS Apps screen first, then connect.</span>
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

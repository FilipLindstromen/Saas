import { useState, useCallback, useEffect, useRef } from 'react'
import type { Platform, PlatformAccount, PublishJob, YouTubePrivacy, AppSettings } from './types'
import { connectYouTube, uploadToYouTube } from './services/youtube'
import { connectInstagram, uploadToInstagram } from './services/instagram'
import { initiateTikTokOAuth, completeTikTokOAuth, uploadToTikTok, TIKTOK_OAUTH_STATE } from './services/tiktok'
import styles from './App.module.css'

const ACCOUNTS_KEY = 'uploader_accounts'
const SETTINGS_KEY = 'uploader_settings'

const PLATFORM_META: Record<Platform, { label: string; icon: string; color: string }> = {
  youtube: { label: 'YouTube', icon: 'yt', color: '#FF0000' },
  instagram: { label: 'Instagram', icon: 'ig', color: '#E1306C' },
  tiktok: { label: 'TikTok', icon: 'tt', color: '#010101' },
}

function loadAccounts(): Partial<Record<Platform, PlatformAccount>> {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveAccounts(accounts: Partial<Record<Platform, PlatformAccount>>) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
  } catch {}
}

function loadSettings(): AppSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    return {
      youtubeClientId: stored.youtubeClientId || import.meta.env.VITE_YOUTUBE_CLIENT_ID || '',
      instagramAppId: stored.instagramAppId || import.meta.env.VITE_INSTAGRAM_APP_ID || '',
      tiktokClientKey: stored.tiktokClientKey || import.meta.env.VITE_TIKTOK_CLIENT_KEY || '',
    }
  } catch {
    return { youtubeClientId: '', instagramAppId: '', tiktokClientKey: '' }
  }
}

function saveSettings(s: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {}
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// --- Icons ---

function IconYouTube() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  )
}

function IconInstagram() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
    </svg>
  )
}

function IconTikTok() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.35 6.35 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/>
    </svg>
  )
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

function IconSun() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )
}

function IconUpload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  )
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}

function IconLink() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  )
}

function PlatformIcon({ platform }: { platform: Platform }) {
  if (platform === 'youtube') return <IconYouTube />
  if (platform === 'instagram') return <IconInstagram />
  return <IconTikTok />
}

// --- Settings Modal ---

function SettingsModal({
  settings,
  onSave,
  onClose,
}: {
  settings: AppSettings
  onSave: (s: AppSettings) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(settings)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave(draft)
    onClose()
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>API Credentials</h2>
          <button className={styles.iconBtn} onClick={onClose}><IconX /></button>
        </div>
        <p className={styles.modalDesc}>
          These are your platform OAuth client IDs. They are stored only in your browser.
          You can also set them via <code>YOUTUBE_CLIENT_ID</code>, <code>INSTAGRAM_APP_ID</code>,
          and <code>TIKTOK_CLIENT_KEY</code> in the root <code>.env</code> file.
        </p>
        <form onSubmit={handleSubmit} className={styles.settingsForm}>
          <label className={styles.fieldLabel}>
            YouTube OAuth Client ID
            <a className={styles.fieldLink} href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">Get one ↗</a>
          </label>
          <input
            className={styles.input}
            type="text"
            placeholder="xxxxxxxx.apps.googleusercontent.com"
            value={draft.youtubeClientId}
            onChange={(e) => setDraft((d) => ({ ...d, youtubeClientId: e.target.value }))}
          />

          <label className={styles.fieldLabel}>
            Facebook / Instagram App ID
            <a className={styles.fieldLink} href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer">Get one ↗</a>
          </label>
          <input
            className={styles.input}
            type="text"
            placeholder="1234567890"
            value={draft.instagramAppId}
            onChange={(e) => setDraft((d) => ({ ...d, instagramAppId: e.target.value }))}
          />

          <label className={styles.fieldLabel}>
            TikTok Client Key
            <a className={styles.fieldLink} href="https://developers.tiktok.com/" target="_blank" rel="noreferrer">Get one ↗</a>
          </label>
          <input
            className={styles.input}
            type="text"
            placeholder="aw1234567890"
            value={draft.tiktokClientKey}
            onChange={(e) => setDraft((d) => ({ ...d, tiktokClientKey: e.target.value }))}
          />

          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.btnPrimary}>Save credentials</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// --- Main App ---

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const stored = localStorage.getItem('saas-apps-theme')
    return stored === 'light' ? 'light' : 'dark'
  })
  const [accounts, setAccounts] = useState<Partial<Record<Platform, PlatformAccount>>>(() => loadAccounts())
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [showSettings, setShowSettings] = useState(false)

  // Video state
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoDuration, setVideoDuration] = useState<number>(0)
  const [isDragging, setIsDragging] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Post metadata
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')

  // Publish settings
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<Platform>>(new Set())
  const [publishMode, setPublishMode] = useState<'now' | 'schedule'>('now')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('09:00')
  const [youtubePrivacy, setYoutubePrivacy] = useState<YouTubePrivacy>('public')

  // Upload state
  const [jobs, setJobs] = useState<Partial<Record<Platform, PublishJob>>>({})
  const [isPublishing, setIsPublishing] = useState(false)
  const [connecting, setConnecting] = useState<Platform | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)

  // Handle TikTok OAuth redirect callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    if (code && state === TIKTOK_OAUTH_STATE) {
      window.history.replaceState({}, '', window.location.pathname)
      setConnecting('tiktok')
      completeTikTokOAuth(code, settings.tiktokClientKey)
        .then(({ accessToken, displayName, userId }) => {
          const account: PlatformAccount = { platform: 'tiktok', displayName, userId, accessToken }
          setAccounts((prev) => {
            const next = { ...prev, tiktok: account }
            saveAccounts(next)
            return next
          })
          setSelectedPlatforms((prev) => new Set([...prev, 'tiktok']))
        })
        .catch((err) => setConnectError(err.message))
        .finally(() => setConnecting(null))
    }
  }, [settings.tiktokClientKey])

  // Persist settings
  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  // Apply theme
  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('saas-apps-theme', next)
  }

  // Video file handling
  const handleVideoFile = useCallback((file: File) => {
    if (!file.type.startsWith('video/')) return
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    const url = URL.createObjectURL(file)
    setVideoFile(file)
    setVideoUrl(url)
    setJobs({})
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))
  }, [videoUrl, title])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleVideoFile(file)
  }, [handleVideoFile])

  // Platform connection
  async function handleConnect(platform: Platform) {
    setConnectError(null)
    setConnecting(platform)
    try {
      let account: PlatformAccount

      if (platform === 'youtube') {
        const { accessToken, displayName } = await connectYouTube(settings.youtubeClientId)
        account = { platform, displayName, accessToken }

      } else if (platform === 'instagram') {
        const { accessToken, userId, igUserId, displayName } = await connectInstagram(settings.instagramAppId)
        account = { platform, displayName, accessToken, userId, igUserId }

      } else {
        // TikTok – redirect flow; the effect above handles the callback
        await initiateTikTokOAuth(settings.tiktokClientKey)
        return
      }

      setAccounts((prev) => {
        const next = { ...prev, [platform]: account }
        saveAccounts(next)
        return next
      })
      setSelectedPlatforms((prev) => new Set([...prev, platform]))
    } catch (err) {
      setConnectError((err as Error).message)
    } finally {
      setConnecting(null)
    }
  }

  function handleDisconnect(platform: Platform) {
    setAccounts((prev) => {
      const next = { ...prev }
      delete next[platform]
      saveAccounts(next)
      return next
    })
    setSelectedPlatforms((prev) => {
      const next = new Set(prev)
      next.delete(platform)
      return next
    })
  }

  function togglePlatform(platform: Platform) {
    if (!accounts[platform]) return
    setSelectedPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(platform)) next.delete(platform)
      else next.add(platform)
      return next
    })
  }

  function updateJob(platform: Platform, patch: Partial<PublishJob>) {
    setJobs((prev) => ({
      ...prev,
      [platform]: { ...(prev[platform] ?? { platform, status: 'idle', progress: 0, message: '' }), ...patch },
    }))
  }

  function getScheduledISO(): string | undefined {
    if (publishMode !== 'schedule' || !scheduledDate) return undefined
    return new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
  }

  async function handlePublish() {
    if (!videoFile || selectedPlatforms.size === 0 || isPublishing) return
    setIsPublishing(true)

    const publishAt = getScheduledISO()
    const fullCaption = [caption, hashtags].filter(Boolean).join('\n\n')

    const tasks = [...selectedPlatforms].map(async (platform) => {
      const account = accounts[platform]
      if (!account) return

      updateJob(platform, { status: 'uploading', progress: 0, message: 'Starting upload…' })

      try {
        if (platform === 'youtube') {
          const videoId = await uploadToYouTube(account.accessToken, videoFile, {
            title: title || videoFile.name,
            description: fullCaption,
            privacyStatus: publishMode === 'schedule' ? 'private' : youtubePrivacy,
            publishAt,
            onProgress: (pct) => updateJob(platform, { progress: pct, message: `Uploading… ${pct}%` }),
          })
          const url = `https://youtu.be/${videoId}`
          updateJob(platform, { status: 'success', progress: 100, message: 'Published!', url })

        } else if (platform === 'instagram') {
          if (!account.igUserId) throw new Error('Instagram account not properly connected')
          const mediaId = await uploadToInstagram(account.accessToken, account.igUserId, videoFile, {
            caption: fullCaption,
            publishAt,
            onProgress: (pct) => updateJob(platform, { progress: pct, message: pct < 80 ? `Uploading… ${pct}%` : 'Processing…' }),
          })
          updateJob(platform, { status: 'success', progress: 100, message: publishAt ? 'Scheduled!' : 'Published!', url: `https://instagram.com/p/${mediaId}` })

        } else if (platform === 'tiktok') {
          await uploadToTikTok(account.accessToken, videoFile, {
            caption: fullCaption,
            publishAt,
            onProgress: (pct) => updateJob(platform, { progress: pct, message: pct < 85 ? `Uploading… ${pct}%` : 'Processing…' }),
          })
          updateJob(platform, { status: 'success', progress: 100, message: publishAt ? 'Scheduled!' : 'Published!' })
        }
      } catch (err) {
        updateJob(platform, { status: 'error', message: (err as Error).message, progress: 0 })
      }
    })

    await Promise.all(tasks)
    setIsPublishing(false)
  }

  const connectedCount = Object.keys(accounts).length
  const readyToPublish = videoFile && selectedPlatforms.size > 0 && !isPublishing
  const isScheduling = publishMode === 'schedule'

  // Min date for schedule picker (now + 15 min)
  const minDate = new Date(Date.now() + 15 * 60000).toISOString().split('T')[0]

  return (
    <div className={styles.app}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLogo}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8" fill="none" stroke="currentColor" strokeWidth="2"/>
            <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <span>Uploader</span>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.iconBtn} onClick={() => setShowSettings(true)} title="API Credentials">
            <IconSettings />
          </button>
          <button className={styles.iconBtn} onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
        </div>
      </header>

      <div className={styles.layout}>
        {/* Sidebar: Platform connections */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTitle}>Connected Platforms</div>
          {connectedCount === 0 && (
            <p className={styles.sidebarHint}>
              Connect at least one platform to start publishing.
            </p>
          )}

          {connectError && (
            <div className={styles.connectError}>
              <strong>Connection failed:</strong>
              <br />
              {connectError}
              <button className={styles.connectErrorClose} onClick={() => setConnectError(null)}>
                <IconX />
              </button>
            </div>
          )}

          {(['youtube', 'instagram', 'tiktok'] as Platform[]).map((platform) => {
            const account = accounts[platform]
            const meta = PLATFORM_META[platform]
            const isConnecting = connecting === platform

            return (
              <div
                key={platform}
                className={`${styles.platformCard} ${account ? styles.platformCardConnected : ''}`}
              >
                <div className={styles.platformCardTop}>
                  <div className={styles.platformIconWrap} style={{ '--p-color': meta.color } as React.CSSProperties}>
                    <PlatformIcon platform={platform} />
                  </div>
                  <div className={styles.platformInfo}>
                    <div className={styles.platformName}>{meta.label}</div>
                    {account ? (
                      <div className={styles.platformUser}>{account.displayName}</div>
                    ) : (
                      <div className={styles.platformUser} style={{ opacity: 0.4 }}>Not connected</div>
                    )}
                  </div>
                  <div className={styles.platformStatus}>
                    {account && <span className={styles.connectedDot} />}
                  </div>
                </div>

                <div className={styles.platformCardActions}>
                  {account ? (
                    <button
                      className={styles.btnDisconnect}
                      onClick={() => handleDisconnect(platform)}
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      className={styles.btnConnect}
                      onClick={() => handleConnect(platform)}
                      disabled={isConnecting}
                    >
                      {isConnecting ? 'Connecting…' : `Connect ${meta.label}`}
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          <div className={styles.sidebarFooter}>
            <button className={styles.btnSettingsLink} onClick={() => setShowSettings(true)}>
              <IconSettings /> Manage API keys
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className={styles.main}>
          <div className={styles.section}>
            <div className={styles.sectionLabel}>1 — Select Video</div>

            {!videoFile ? (
              <div
                className={`${styles.dropzone} ${isDragging ? styles.dropzoneDragging : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              >
                <div className={styles.dropzoneIcon}><IconUpload /></div>
                <div className={styles.dropzoneText}>Drop a video here</div>
                <div className={styles.dropzoneSubtext}>or click to browse · MP4, MOV, WebM</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVideoFile(f) }}
                />
              </div>
            ) : (
              <div className={styles.videoPreview}>
                <video
                  ref={videoRef}
                  src={videoUrl!}
                  className={styles.videoEl}
                  controls
                  onLoadedMetadata={(e) => setVideoDuration((e.target as HTMLVideoElement).duration)}
                />
                <div className={styles.videoMeta}>
                  <span className={styles.videoMetaItem}>{videoFile.name}</span>
                  <span className={styles.videoMetaDot}>·</span>
                  <span className={styles.videoMetaItem}>{formatBytes(videoFile.size)}</span>
                  {videoDuration > 0 && (
                    <>
                      <span className={styles.videoMetaDot}>·</span>
                      <span className={styles.videoMetaItem}>{formatDuration(videoDuration)}</span>
                    </>
                  )}
                  <button
                    className={styles.changeVideoBtn}
                    onClick={() => { setVideoFile(null); setVideoUrl(null); setJobs({}) }}
                  >
                    Change video
                  </button>
                </div>
              </div>
            )}
          </div>

          {videoFile && (
            <>
              <div className={styles.section}>
                <div className={styles.sectionLabel}>2 — Add Details</div>

                {/* YouTube title */}
                {accounts.youtube && (
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>
                      Title <span className={styles.fieldNote}>(YouTube)</span>
                    </label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="Enter a title for YouTube…"
                      value={title}
                      maxLength={100}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                    <div className={styles.charCount}>{title.length}/100</div>
                  </div>
                )}

                {/* Caption */}
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Caption / Description</label>
                  <textarea
                    className={styles.textarea}
                    placeholder="Write a caption for your post…"
                    value={caption}
                    maxLength={2200}
                    rows={4}
                    onChange={(e) => setCaption(e.target.value)}
                  />
                  <div className={styles.charCount}>{caption.length}/2200</div>
                </div>

                {/* Hashtags */}
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Hashtags</label>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="#trending #video #content"
                    value={hashtags}
                    onChange={(e) => setHashtags(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.section}>
                <div className={styles.sectionLabel}>3 — Select Platforms</div>
                <div className={styles.platformPicker}>
                  {(['youtube', 'instagram', 'tiktok'] as Platform[]).map((platform) => {
                    const account = accounts[platform]
                    const meta = PLATFORM_META[platform]
                    const checked = selectedPlatforms.has(platform)
                    const job = jobs[platform]

                    return (
                      <button
                        key={platform}
                        className={`${styles.platformToggle} ${checked ? styles.platformToggleChecked : ''} ${!account ? styles.platformToggleDisabled : ''}`}
                        onClick={() => togglePlatform(platform)}
                        disabled={!account}
                        title={!account ? `Connect ${meta.label} first` : undefined}
                      >
                        <span className={styles.platformToggleIcon} style={{ '--p-color': meta.color } as React.CSSProperties}>
                          <PlatformIcon platform={platform} />
                        </span>
                        <span className={styles.platformToggleLabel}>{meta.label}</span>
                        {account && !job && (
                          <span className={styles.platformToggleCheck}>{checked && <IconCheck />}</span>
                        )}
                        {job && (
                          <span className={`${styles.jobBadge} ${styles[`jobBadge_${job.status}`]}`}>
                            {job.status === 'success' ? <IconCheck /> : job.status === 'error' ? <IconX /> : `${job.progress}%`}
                          </span>
                        )}
                        {!account && <span className={styles.platformToggleHint}>Not connected</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className={styles.section}>
                <div className={styles.sectionLabel}>4 — When to Publish</div>
                <div className={styles.publishModeRow}>
                  <label className={`${styles.radioOption} ${publishMode === 'now' ? styles.radioOptionActive : ''}`}>
                    <input
                      type="radio"
                      name="publishMode"
                      checked={publishMode === 'now'}
                      onChange={() => setPublishMode('now')}
                    />
                    <span className={styles.radioLabel}>Publish now</span>
                  </label>
                  <label className={`${styles.radioOption} ${publishMode === 'schedule' ? styles.radioOptionActive : ''}`}>
                    <input
                      type="radio"
                      name="publishMode"
                      checked={publishMode === 'schedule'}
                      onChange={() => setPublishMode('schedule')}
                    />
                    <span className={styles.radioLabel}>Schedule</span>
                  </label>
                </div>

                {isScheduling && (
                  <div className={styles.scheduleRow}>
                    <input
                      className={styles.input}
                      type="date"
                      value={scheduledDate}
                      min={minDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                    />
                    <input
                      className={styles.input}
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                    />
                  </div>
                )}

                {/* YouTube visibility */}
                {accounts.youtube && selectedPlatforms.has('youtube') && (
                  <div className={styles.fieldGroup} style={{ marginTop: '12px' }}>
                    <label className={styles.fieldLabel}>
                      YouTube visibility
                    </label>
                    <select
                      className={styles.select}
                      value={youtubePrivacy}
                      onChange={(e) => setYoutubePrivacy(e.target.value as YouTubePrivacy)}
                      disabled={isScheduling}
                    >
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Private</option>
                    </select>
                    {isScheduling && (
                      <div className={styles.fieldHint}>Scheduled videos are set to Private until publish time.</div>
                    )}
                  </div>
                )}
              </div>

              {/* Job results */}
              {Object.values(jobs).length > 0 && (
                <div className={styles.jobResults}>
                  {(Object.values(jobs) as PublishJob[]).map((job) => (
                    <div key={job.platform} className={`${styles.jobResult} ${styles[`jobResult_${job.status}`]}`}>
                      <div className={styles.jobResultHeader}>
                        <span className={styles.jobResultPlatform}>
                          <PlatformIcon platform={job.platform} />
                          {PLATFORM_META[job.platform].label}
                        </span>
                        <span className={styles.jobResultStatus}>{job.message}</span>
                      </div>
                      {job.status === 'uploading' || job.status === 'processing' ? (
                        <div className={styles.progressBar}>
                          <div className={styles.progressFill} style={{ width: `${job.progress}%` }} />
                        </div>
                      ) : null}
                      {job.url && (
                        <a className={styles.jobResultUrl} href={job.url} target="_blank" rel="noreferrer">
                          <IconLink /> View post ↗
                        </a>
                      )}
                      {job.status === 'error' && (
                        <div className={styles.jobResultError}>{job.error || job.message}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Publish button */}
              <div className={styles.publishRow}>
                <button
                  className={`${styles.btnPublish} ${!readyToPublish ? styles.btnPublishDisabled : ''}`}
                  onClick={handlePublish}
                  disabled={!readyToPublish}
                >
                  {isPublishing ? (
                    <>
                      <span className={styles.spinner} />
                      Publishing…
                    </>
                  ) : isScheduling ? (
                    `Schedule to ${selectedPlatforms.size} platform${selectedPlatforms.size !== 1 ? 's' : ''}`
                  ) : (
                    `Publish to ${selectedPlatforms.size} platform${selectedPlatforms.size !== 1 ? 's' : ''}`
                  )}
                </button>
                {selectedPlatforms.size === 0 && (
                  <span className={styles.publishHint}>Select at least one platform above</span>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={(s) => { setSettings(s); saveSettings(s) }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}

import { useState, useCallback, useEffect, useRef } from 'react'
import type {
  Platform, PlatformAccount, PublishJob, YouTubePrivacy, AppSettings,
  CaptionSegment, CaptionStyle, CaptionAnimation,
} from './types'
import { connectYouTube, uploadToYouTube } from './services/youtube'
import { connectInstagram, uploadToInstagram } from './services/instagram'
import { initiateTikTokOAuth, completeTikTokOAuth, uploadToTikTok, TIKTOK_OAUTH_STATE } from './services/tiktok'
import { transcribeVideo } from './services/transcription'
import { exportVideoWithCaptions, getVideoDimensions } from './utils/captionExport'
import { CaptionVideoPreview } from './components/CaptionVideoPreview'
import { CAPTION_STYLES, CAPTION_ANIMATIONS, GOOGLE_FONTS, FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_DEFAULT } from './constants'
import styles from './App.module.css'

// ── localStorage keys ─────────────────────────────────────────────────────
const ACCOUNTS_KEY = 'uploader_accounts'
const SETTINGS_KEY = 'uploader_settings'

// ── Platform metadata ─────────────────────────────────────────────────────
const PLATFORM_META: Record<Platform, { label: string; color: string }> = {
  youtube:   { label: 'YouTube',   color: '#FF0000' },
  instagram: { label: 'Instagram', color: '#E1306C' },
  tiktok:    { label: 'TikTok',    color: '#010101' },
}

// ── Persistence helpers ───────────────────────────────────────────────────
function loadAccounts(): Partial<Record<Platform, PlatformAccount>> {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '{}') } catch { return {} }
}
function saveAccounts(a: Partial<Record<Platform, PlatformAccount>>) {
  try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(a)) } catch {}
}
function loadSettings(): AppSettings {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    return {
      youtubeClientId:  s.youtubeClientId  || import.meta.env.VITE_YOUTUBE_CLIENT_ID  || '',
      instagramAppId:   s.instagramAppId   || import.meta.env.VITE_INSTAGRAM_APP_ID   || '',
      tiktokClientKey:  s.tiktokClientKey  || import.meta.env.VITE_TIKTOK_CLIENT_KEY  || '',
    }
  } catch { return { youtubeClientId: '', instagramAppId: '', tiktokClientKey: '' } }
}
function saveSettings(s: AppSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch {}
}

/** Load OpenAI key from the shared saas API keys store */
function loadOpenAiKey(): string {
  try {
    const raw = localStorage.getItem('saas_api_keys')
    if (!raw) return ''
    return JSON.parse(raw)?.openai ?? ''
  } catch { return '' }
}

// ── Formatters ────────────────────────────────────────────────────────────
function formatBytes(b: number) {
  return b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`
}
function formatDuration(s: number) {
  const m = Math.floor(s / 60); const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}
function formatTime(s: number) {
  const m = Math.floor(s / 60); const sec = Math.floor(s % 60)
  const ms = Math.floor((s % 1) * 100)
  return `${m}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}

// ── Platform icons (SVG) ──────────────────────────────────────────────────
function IconYT() {
  return <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
}
function IconIG() {
  return <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
}
function IconTT() {
  return <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.35 6.35 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/></svg>
}
function PlatformIcon({ p }: { p: Platform }) {
  if (p === 'youtube') return <IconYT />
  if (p === 'instagram') return <IconIG />
  return <IconTT />
}

// ── Small icon set ────────────────────────────────────────────────────────
const IconCheck = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>
const IconX     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const IconLink  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
const IconMoon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
const IconSun   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
const IconGear  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
const IconUpload = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>

// ── Settings Modal ────────────────────────────────────────────────────────
function SettingsModal({ settings, onSave, onClose }: { settings: AppSettings; onSave: (s: AppSettings) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(settings)
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>API Credentials</h2>
          <button className={styles.iconBtn} onClick={onClose}><IconX /></button>
        </div>
        <p className={styles.modalDesc}>
          Stored in your browser only. Social platform keys are for publishing.
          The <strong>OpenAI key</strong> for transcription is shared — set it via the{' '}
          <a href="../index.html" target="_blank" rel="noreferrer" className={styles.modalLink}>SaaS Apps screen</a>.
        </p>
        <div className={styles.settingsForm}>
          {([
            ['youtubeClientId',  'YouTube OAuth Client ID',      'xxxxxxxx.apps.googleusercontent.com', 'https://console.cloud.google.com/apis/credentials'],
            ['instagramAppId',   'Facebook / Instagram App ID',  '1234567890',                          'https://developers.facebook.com/apps/'],
            ['tiktokClientKey',  'TikTok Client Key',            'aw1234567890',                        'https://developers.tiktok.com/'],
          ] as [keyof AppSettings, string, string, string][]).map(([key, label, ph, url]) => (
            <div key={key} className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>
                {label}
                <a className={styles.fieldLink} href={url} target="_blank" rel="noreferrer">Get one ↗</a>
              </label>
              <input className={styles.input} type="text" placeholder={ph}
                value={draft[key]} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} />
            </div>
          ))}
          <div className={styles.modalFooter}>
            <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
            <button className={styles.btnPrimary} onClick={() => { onSave(draft); onClose() }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  // Theme
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    localStorage.getItem('saas-apps-theme') === 'light' ? 'light' : 'dark'
  )

  // Platform accounts & settings
  const [accounts, setAccounts] = useState<Partial<Record<Platform, PlatformAccount>>>(() => loadAccounts())
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [showSettings, setShowSettings] = useState(false)
  const [connecting, setConnecting] = useState<Platform | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)

  // Active tab
  const [activeTab, setActiveTab] = useState<'captions' | 'publish'>('captions')

  // Shared video state
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoDuration, setVideoDuration] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Mobile UI state ───────────────────────────────────────────────────
  const [mobileCaptionSubTab, setMobileCaptionSubTab] = useState<'preview' | 'transcript' | 'styles'>('preview')
  const [showMobilePlatforms, setShowMobilePlatforms] = useState(false)

  // ── Captions tab state ─────────────────────────────────────────────────
  const [segments, setSegments] = useState<CaptionSegment[]>([])
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcribeError, setTranscribeError] = useState<string | null>(null)
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>('lower-third')
  const [captionAnimation, setCaptionAnimation] = useState<CaptionAnimation>('fade')
  const [animateByWord, setAnimateByWord] = useState(false)
  const [fontFamily, setFontFamily] = useState('Oswald')
  const [fontSizePercent, setFontSizePercent] = useState(FONT_SIZE_DEFAULT)
  const [captionY, setCaptionY] = useState(0.85)
  const [isDraggingY, setIsDraggingY] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [videoDimensions, setVideoDimensions] = useState({ width: 1280, height: 720 })
  const [exportFormat, setExportFormat] = useState<'webm' | 'mp4'>('mp4')
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)

  // ── Publish tab state ──────────────────────────────────────────────────
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<Platform>>(new Set())
  const [publishMode, setPublishMode] = useState<'now' | 'schedule'>('now')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('09:00')
  const [youtubePrivacy, setYoutubePrivacy] = useState<YouTubePrivacy>('public')
  const [jobs, setJobs] = useState<Partial<Record<Platform, PublishJob>>>({})
  const [isPublishing, setIsPublishing] = useState(false)

  // ── TikTok OAuth callback ──────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code && params.get('state') === TIKTOK_OAUTH_STATE) {
      window.history.replaceState({}, '', window.location.pathname)
      setConnecting('tiktok')
      completeTikTokOAuth(code, settings.tiktokClientKey)
        .then(({ accessToken, displayName, userId }) => {
          const account: PlatformAccount = { platform: 'tiktok', displayName, userId, accessToken }
          setAccounts((prev) => { const next = { ...prev, tiktok: account }; saveAccounts(next); return next })
          setSelectedPlatforms((prev) => new Set([...prev, 'tiktok']))
        })
        .catch((err) => setConnectError(err.message))
        .finally(() => setConnecting(null))
    }
  }, [settings.tiktokClientKey])

  useEffect(() => { saveSettings(settings) }, [settings])

  // ── Theme ──────────────────────────────────────────────────────────────
  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('saas-apps-theme', next)
  }

  // ── Video file ─────────────────────────────────────────────────────────
  const handleVideoFile = useCallback((file: File) => {
    if (!file.type.startsWith('video/')) return
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoFile(file)
    setVideoUrl(URL.createObjectURL(file))
    setSegments([])
    setJobs({})
    setTranscribeError(null)
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))
    getVideoDimensions(file).then(setVideoDimensions).catch(() => {})
  }, [videoUrl, title])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files[0]; if (f) handleVideoFile(f)
  }, [handleVideoFile])

  // ── Platform connect / disconnect ──────────────────────────────────────
  async function handleConnect(platform: Platform) {
    setConnectError(null); setConnecting(platform)
    try {
      let account: PlatformAccount
      if (platform === 'youtube') {
        const { accessToken, displayName } = await connectYouTube(settings.youtubeClientId)
        account = { platform, displayName, accessToken }
      } else if (platform === 'instagram') {
        const { accessToken, userId, igUserId, displayName } = await connectInstagram(settings.instagramAppId)
        account = { platform, displayName, accessToken, userId, igUserId }
      } else {
        await initiateTikTokOAuth(settings.tiktokClientKey); return
      }
      setAccounts((prev) => { const next = { ...prev, [platform]: account }; saveAccounts(next); return next })
      setSelectedPlatforms((prev) => new Set([...prev, platform]))
    } catch (err) {
      setConnectError((err as Error).message)
    } finally {
      setConnecting(null)
    }
  }

  function handleDisconnect(platform: Platform) {
    setAccounts((prev) => { const next = { ...prev }; delete next[platform]; saveAccounts(next); return next })
    setSelectedPlatforms((prev) => { const next = new Set(prev); next.delete(platform); return next })
  }

  function togglePlatform(platform: Platform) {
    if (!accounts[platform]) return
    setSelectedPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(platform)) next.delete(platform); else next.add(platform)
      return next
    })
  }

  // ── Transcription ──────────────────────────────────────────────────────
  async function handleTranscribe() {
    if (!videoFile) return
    setTranscribeError(null); setIsTranscribing(true)
    try {
      const result = await transcribeVideo(videoFile, loadOpenAiKey())
      setSegments(result)
      // Auto-populate caption field if empty
      if (!caption) {
        setCaption(result.map((s) => s.text).join(' ').trim())
      }
    } catch (e) {
      setTranscribeError(e instanceof Error ? e.message : 'Transcription failed')
    } finally {
      setIsTranscribing(false)
    }
  }

  // ── Export with captions ───────────────────────────────────────────────
  async function handleExport() {
    if (!videoFile || segments.length === 0) return
    setIsExporting(true); setExportProgress(0)
    try {
      const { blob, extension } = await exportVideoWithCaptions(videoFile, {
        width: videoDimensions.width,
        height: videoDimensions.height,
        format: exportFormat,
        segments,
        captionStyle,
        captionAnimation,
        animateByWord,
        fontFamily,
        fontSizePercent,
        captionY,
        onProgress: setExportProgress,
      })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `captions_export.${extension}`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      console.error('Export failed', e)
    } finally {
      setIsExporting(false); setExportProgress(0)
    }
  }

  // ── Seek helper ────────────────────────────────────────────────────────
  const handleSeek = useCallback((time: number) => {
    const video = document.querySelector<HTMLVideoElement>('video')
    if (video) { video.currentTime = time; setCurrentTime(time) }
  }, [])

  // ── Publish ────────────────────────────────────────────────────────────
  function updateJob(platform: Platform, patch: Partial<PublishJob>) {
    setJobs((prev) => ({
      ...prev,
      [platform]: { ...(prev[platform] ?? { platform, status: 'idle', progress: 0, message: '' }), ...patch },
    }))
  }

  async function handlePublish() {
    if (!videoFile || selectedPlatforms.size === 0 || isPublishing) return
    setIsPublishing(true)
    const publishAt = publishMode === 'schedule' && scheduledDate
      ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
      : undefined
    const fullCaption = [caption, hashtags].filter(Boolean).join('\n\n')

    await Promise.all([...selectedPlatforms].map(async (platform) => {
      const account = accounts[platform]
      if (!account) return
      updateJob(platform, { status: 'uploading', progress: 0, message: 'Starting…' })
      try {
        if (platform === 'youtube') {
          const videoId = await uploadToYouTube(account.accessToken, videoFile, {
            title: title || videoFile.name,
            description: fullCaption,
            privacyStatus: publishAt ? 'private' : youtubePrivacy,
            publishAt,
            onProgress: (pct) => updateJob(platform, { progress: pct, message: `Uploading… ${pct}%` }),
          })
          updateJob(platform, { status: 'success', progress: 100, message: 'Published!', url: `https://youtu.be/${videoId}` })
        } else if (platform === 'instagram') {
          if (!account.igUserId) throw new Error('Instagram account not properly connected')
          const mediaId = await uploadToInstagram(account.accessToken, account.igUserId, videoFile, {
            caption: fullCaption, publishAt,
            onProgress: (pct) => updateJob(platform, { progress: pct, message: pct < 80 ? `Uploading… ${pct}%` : 'Processing…' }),
          })
          updateJob(platform, { status: 'success', progress: 100, message: publishAt ? 'Scheduled!' : 'Published!', url: `https://instagram.com/p/${mediaId}` })
        } else if (platform === 'tiktok') {
          await uploadToTikTok(account.accessToken, videoFile, {
            caption: fullCaption, publishAt,
            onProgress: (pct) => updateJob(platform, { progress: pct, message: pct < 85 ? `Uploading… ${pct}%` : 'Processing…' }),
          })
          updateJob(platform, { status: 'success', progress: 100, message: publishAt ? 'Scheduled!' : 'Published!' })
        }
      } catch (err) {
        updateJob(platform, { status: 'error', progress: 0, message: (err as Error).message })
      }
    }))
    setIsPublishing(false)
  }

  const minDate = new Date(Date.now() + 15 * 60000).toISOString().split('T')[0]
  const fullTranscript = segments.map((s) => s.text).join(' ')

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className={styles.app}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20" style={{ color: 'var(--accent)' }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span className={styles.headerTitle}>Uploader</span>

          {videoFile && (
            <div className={styles.tabBar}>
              <button className={`${styles.tab} ${activeTab === 'captions' ? styles.tabActive : ''}`} onClick={() => setActiveTab('captions')}>Captions</button>
              <button className={`${styles.tab} ${activeTab === 'publish' ? styles.tabActive : ''}`} onClick={() => setActiveTab('publish')}>Publish</button>
            </div>
          )}
        </div>
        <div className={styles.headerRight}>
          <button className={styles.iconBtn} onClick={() => setShowSettings(true)} title="API credentials"><IconGear /></button>
          <button className={styles.iconBtn} onClick={toggleTheme} title="Toggle theme">{theme === 'dark' ? <IconSun /> : <IconMoon />}</button>
        </div>
      </header>

      <div className={styles.layout}>
        {/* Sidebar: platform connections */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTitle}>Platforms</div>

          {connectError && (
            <div className={styles.connectError}>
              {connectError}
              <button className={styles.connectErrorClose} onClick={() => setConnectError(null)}><IconX /></button>
            </div>
          )}

          {(['youtube', 'instagram', 'tiktok'] as Platform[]).map((platform) => {
            const account = accounts[platform]
            const meta = PLATFORM_META[platform]
            return (
              <div key={platform} className={`${styles.platformCard} ${account ? styles.platformCardConnected : ''}`}>
                <div className={styles.platformCardTop}>
                  <div className={styles.platformIconWrap} style={{ '--p-color': meta.color } as React.CSSProperties}>
                    <PlatformIcon p={platform} />
                  </div>
                  <div className={styles.platformInfo}>
                    <div className={styles.platformName}>{meta.label}</div>
                    <div className={styles.platformUser} style={{ opacity: account ? 1 : 0.4 }}>
                      {account ? account.displayName : 'Not connected'}
                    </div>
                  </div>
                  {account && <span className={styles.connectedDot} />}
                </div>
                <div className={styles.platformCardActions}>
                  {account ? (
                    <button className={styles.btnDisconnect} onClick={() => handleDisconnect(platform)}>Disconnect</button>
                  ) : (
                    <button className={styles.btnConnect} onClick={() => handleConnect(platform)}
                      disabled={connecting === platform}>
                      {connecting === platform ? 'Connecting…' : `Connect`}
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          <div className={styles.sidebarFooter}>
            <button className={styles.btnSettingsLink} onClick={() => setShowSettings(true)}>
              <IconGear /> Manage API keys
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div className={styles.contentArea}>
          {/* Video dropzone — shown when no file */}
          {!videoFile && (
            <div className={styles.dropzoneWrap}>
              <div
                className={`${styles.dropzone} ${isDragging ? styles.dropzoneDragging : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button" tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              >
                <div className={styles.dropzoneIcon}><IconUpload /></div>
                <div className={styles.dropzoneText}>Drop a video here</div>
                <div className={styles.dropzoneSubtext}>or click to browse · MP4, MOV, WebM</div>
              </div>
              <input ref={fileInputRef} type="file" accept="video/*" style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVideoFile(f); e.target.value = '' }} />
            </div>
          )}

          {/* Video selected: show video info bar + tabs */}
          {videoFile && (
            <>
              {/* Video info bar */}
              <div className={styles.videoBar}>
                <span className={styles.videoBarName}>{videoFile.name}</span>
                <span className={styles.videoBarMeta}>{formatBytes(videoFile.size)}{videoDuration > 0 ? ` · ${formatDuration(videoDuration)}` : ''}</span>
                <button className={styles.changeVideoBtn} onClick={() => { setVideoFile(null); setVideoUrl(null); setSegments([]); setJobs({}) }}>
                  Change video
                </button>
                <input ref={fileInputRef} type="file" accept="video/*" style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVideoFile(f); e.target.value = '' }} />
              </div>

              {/* ── CAPTIONS TAB ── */}
              {activeTab === 'captions' && videoUrl && (
                <>
                {/* Mobile sub-tab bar — hidden on desktop via CSS */}
                <div className={styles.mobileSubTabs}>
                  {([
                    ['preview',    'Preview'],
                    ['transcript', 'Transcript'],
                    ['styles',     'Styles'],
                  ] as const).map(([key, label]) => (
                    <button key={key}
                      className={`${styles.mobileSubTab} ${mobileCaptionSubTab === key ? styles.mobileSubTabActive : ''}`}
                      onClick={() => setMobileCaptionSubTab(key)}>
                      {label}
                    </button>
                  ))}
                </div>

                <div className={styles.captionLayout}>
                  {/* Left: Transcript */}
                  <div className={`${styles.transcriptPanel} ${mobileCaptionSubTab !== 'transcript' ? styles.mobileHidePanel : ''}`}>
                    <div className={styles.panelTitle}>Transcript</div>
                    <button className={styles.transcribeBtn} onClick={handleTranscribe} disabled={isTranscribing}>
                      {isTranscribing
                        ? <><span className={styles.spinner} />Transcribing…</>
                        : 'Transcribe with OpenAI'}
                    </button>
                    {transcribeError && <div className={styles.transcribeError}>{transcribeError}</div>}
                    <p className={styles.panelHint}>Edit to fix spelling. Click a timestamp to seek.</p>
                    <textarea
                      className={styles.transcriptArea}
                      value={fullTranscript}
                      placeholder="Upload a video and click Transcribe…"
                      onChange={(e) => {
                        const text = e.target.value
                        if (segments.length === 0) return
                        const first = segments[0]; const last = segments[segments.length - 1]
                        setSegments([{ start: first.start, end: last.end, text: text.trim() }])
                        setCaption(text.trim())
                      }}
                    />
                    {segments.length > 0 && (
                      <div className={styles.timeStamps}>
                        {segments.map((seg, i) => {
                          const isActive = currentTime >= seg.start && currentTime < seg.end
                          return (
                            <button key={i} className={`${styles.timeBtn} ${isActive ? styles.timeBtnActive : ''}`}
                              onClick={() => handleSeek(seg.start)} title={`Go to ${formatTime(seg.start)}`}>
                              {formatTime(seg.start)}–{formatTime(seg.end)}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Center: Canvas preview */}
                  <div className={`${styles.previewCol} ${mobileCaptionSubTab !== 'preview' ? styles.mobileHidePanel : ''}`}>
                    <CaptionVideoPreview
                      videoUrl={videoUrl}
                      segments={segments.length > 0 ? segments : null}
                      currentTime={currentTime}
                      onTimeUpdate={setCurrentTime}
                      onDurationChange={setVideoDuration}
                      onSeek={handleSeek}
                      captionStyle={captionStyle}
                      captionAnimation={captionAnimation}
                      animateByWord={animateByWord}
                      fontFamily={fontFamily}
                      fontSizePercent={fontSizePercent}
                      captionY={captionY}
                      onCaptionYChange={setCaptionY}
                      isDraggingY={isDraggingY}
                      onDraggingYChange={setIsDraggingY}
                    />
                    {/* Export bar */}
                    <div className={styles.exportBar}>
                      <select className={styles.exportSelect} value={exportFormat}
                        onChange={(e) => setExportFormat(e.target.value as 'webm' | 'mp4')}>
                        <option value="mp4">MP4</option>
                        <option value="webm">WebM</option>
                      </select>
                      <button className={styles.exportBtn} onClick={handleExport}
                        disabled={isExporting || segments.length === 0}>
                        {isExporting ? `Exporting… ${Math.round(exportProgress)}%` : 'Export with captions'}
                      </button>
                      <button className={styles.btnSecondary} onClick={() => setActiveTab('publish')} style={{ marginLeft: 'auto' }}>
                        Go to Publish →
                      </button>
                    </div>
                    {segments.length === 0 && (
                      <p className={styles.panelHint} style={{ textAlign: 'center', marginTop: 4 }}>
                        Transcribe first to export with baked-in captions.
                      </p>
                    )}
                    {/* Mobile: Export button shown in preview sub-tab */}
                    <button className={`${styles.mobileExportTabBtn} ${styles.mobileSubTabTrigger}`}
                      onClick={() => setMobileCaptionSubTab('transcript')}>
                      Edit transcript →
                    </button>
                  </div>

                  {/* Right: Style panel */}
                  <div className={`${styles.stylePanel} ${mobileCaptionSubTab !== 'styles' ? styles.mobileHidePanel : ''}`}>
                    <div className={styles.panelTitle}>Caption style</div>
                    <div className={styles.styleSections}>
                      <div className={styles.styleSection}>
                        <label className={styles.styleLabel}>Style</label>
                        <select className={styles.styleSelect} value={captionStyle}
                          onChange={(e) => setCaptionStyle(e.target.value as CaptionStyle)}>
                          {CAPTION_STYLES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </div>
                      <div className={styles.styleSection}>
                        <label className={styles.styleLabel}>In/Out animation</label>
                        <select className={styles.styleSelect} value={captionAnimation}
                          onChange={(e) => setCaptionAnimation(e.target.value as CaptionAnimation)}>
                          {CAPTION_ANIMATIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </div>
                      <div className={styles.styleSection}>
                        <label className={styles.checkLabel}>
                          <input type="checkbox" checked={animateByWord}
                            onChange={(e) => setAnimateByWord(e.target.checked)} />
                          Animate by word
                        </label>
                        <p className={styles.styleHint}>Apply animation per word (needs word timing from transcription).</p>
                      </div>
                      <div className={styles.styleSection}>
                        <label className={styles.styleLabel}>Font</label>
                        <select className={styles.styleSelect} value={fontFamily}
                          onChange={(e) => setFontFamily(e.target.value)}>
                          {GOOGLE_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <div className={styles.styleSection}>
                        <label className={styles.styleLabel}>Font size ({fontSizePercent.toFixed(1)}%)</label>
                        <input type="range" className={styles.slider}
                          min={FONT_SIZE_MIN} max={FONT_SIZE_MAX} step={0.1} value={fontSizePercent}
                          onChange={(e) => setFontSizePercent(Number(e.target.value))} />
                      </div>
                      <div className={styles.styleSection}>
                        <label className={styles.styleLabel}>Y position ({(captionY * 100).toFixed(0)}%)</label>
                        <input type="range" className={styles.slider}
                          min={0.05} max={0.95} step={0.01} value={captionY}
                          onChange={(e) => setCaptionY(Number(e.target.value))} />
                        <p className={styles.styleHint}>Or drag the orange bar on the video.</p>
                      </div>
                    </div>
                  </div>
                </div>
                </>
              )}

              {/* ── PUBLISH TAB ── */}
              {activeTab === 'publish' && (
                <div className={styles.publishLayout}>
                  {/* Mobile-only: platforms section (sidebar is hidden on mobile) */}
                  <div className={styles.mobilePlatformSection}>
                    <button className={styles.mobilePlatformToggle} onClick={() => setShowMobilePlatforms(v => !v)}>
                      <span>Platforms</span>
                      <span className={styles.mobilePlatformBadge}>
                        {Object.keys(accounts).length} connected
                      </span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        style={{ transform: showMobilePlatforms ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>
                    {showMobilePlatforms && (
                      <div className={styles.mobilePlatformCards}>
                        {(['youtube', 'instagram', 'tiktok'] as Platform[]).map((p) => {
                          const meta = PLATFORM_META[p]
                          const acc  = accounts[p]
                          const busy = connecting === p
                          return (
                            <div key={p} className={`${styles.platformCard} ${acc ? styles.platformCardConnected : ''}`}
                              style={{ '--p-color': meta.color } as React.CSSProperties}>
                              <div className={styles.platformCardTop}>
                                <div className={styles.platformIconWrap}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <rect width="24" height="24" rx="4" fill="transparent"/>
                                    <text x="12" y="17" textAnchor="middle" fontSize="14" fontWeight="bold">{meta.label[0]}</text>
                                  </svg>
                                </div>
                                <div className={styles.platformInfo}>
                                  <div className={styles.platformName}>{meta.label}</div>
                                  {acc && <div className={styles.platformUser}>{acc.username}</div>}
                                </div>
                                {acc && <div className={styles.connectedDot}/>}
                              </div>
                              <div className={styles.platformCardActions}>
                                {acc
                                  ? <button className={styles.btnDisconnect} onClick={() => handleDisconnect(p)}>Disconnect</button>
                                  : <button className={styles.btnConnect} disabled={busy} onClick={() => handleConnect(p)}>
                                      {busy ? 'Connecting…' : 'Connect'}
                                    </button>
                                }
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className={styles.section}>
                    <div className={styles.sectionLabel}>1 — Add Details</div>
                    {accounts.youtube && (
                      <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>Title <span className={styles.fieldNote}>(YouTube)</span></label>
                        <input className={styles.input} type="text" placeholder="Enter a title for YouTube…"
                          value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
                        <div className={styles.charCount}>{title.length}/100</div>
                      </div>
                    )}
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>
                        Caption / Description
                        {segments.length > 0 && !caption && (
                          <button className={styles.fieldLink} onClick={() => setCaption(fullTranscript)}>
                            Use transcript ↗
                          </button>
                        )}
                      </label>
                      <textarea className={styles.textarea} placeholder="Write a caption…"
                        value={caption} maxLength={2200} rows={5}
                        onChange={(e) => setCaption(e.target.value)} />
                      <div className={styles.charCount}>{caption.length}/2200</div>
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Hashtags</label>
                      <input className={styles.input} type="text" placeholder="#trending #video"
                        value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
                    </div>
                  </div>

                  <div className={styles.section}>
                    <div className={styles.sectionLabel}>2 — Select Platforms</div>
                    <div className={styles.platformPicker}>
                      {(['youtube', 'instagram', 'tiktok'] as Platform[]).map((platform) => {
                        const account = accounts[platform]
                        const meta = PLATFORM_META[platform]
                        const checked = selectedPlatforms.has(platform)
                        const job = jobs[platform]
                        return (
                          <button key={platform}
                            className={`${styles.platformToggle} ${checked ? styles.platformToggleChecked : ''} ${!account ? styles.platformToggleDisabled : ''}`}
                            onClick={() => togglePlatform(platform)} disabled={!account}
                            title={!account ? `Connect ${meta.label} first` : undefined}>
                            <span style={{ color: meta.color, display: 'flex', alignItems: 'center' }}><PlatformIcon p={platform} /></span>
                            <span>{meta.label}</span>
                            {account && !job && checked && <span className={styles.platformToggleCheck}><IconCheck /></span>}
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
                    <div className={styles.sectionLabel}>3 — When to Publish</div>
                    <div className={styles.publishModeRow}>
                      {(['now', 'schedule'] as const).map((mode) => (
                        <label key={mode} className={`${styles.radioOption} ${publishMode === mode ? styles.radioOptionActive : ''}`}>
                          <input type="radio" name="publishMode" checked={publishMode === mode} onChange={() => setPublishMode(mode)} />
                          <span>{mode === 'now' ? 'Publish now' : 'Schedule'}</span>
                        </label>
                      ))}
                    </div>
                    {publishMode === 'schedule' && (
                      <div className={styles.scheduleRow}>
                        <input className={styles.input} type="date" value={scheduledDate} min={minDate}
                          onChange={(e) => setScheduledDate(e.target.value)} />
                        <input className={styles.input} type="time" value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)} />
                      </div>
                    )}
                    {accounts.youtube && selectedPlatforms.has('youtube') && (
                      <div className={styles.fieldGroup} style={{ marginTop: 12 }}>
                        <label className={styles.fieldLabel}>YouTube visibility</label>
                        <select className={styles.select} value={youtubePrivacy}
                          onChange={(e) => setYoutubePrivacy(e.target.value as YouTubePrivacy)}
                          disabled={publishMode === 'schedule'}>
                          <option value="public">Public</option>
                          <option value="unlisted">Unlisted</option>
                          <option value="private">Private</option>
                        </select>
                        {publishMode === 'schedule' && (
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
                            <span className={styles.jobResultPlatform}><PlatformIcon p={job.platform} />{PLATFORM_META[job.platform].label}</span>
                            <span className={styles.jobResultStatus}>{job.message}</span>
                          </div>
                          {(job.status === 'uploading' || job.status === 'processing') && (
                            <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: `${job.progress}%` }} /></div>
                          )}
                          {job.url && <a className={styles.jobResultUrl} href={job.url} target="_blank" rel="noreferrer"><IconLink /> View post ↗</a>}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className={styles.publishRow}>
                    <button
                      className={`${styles.btnPublish} ${(!videoFile || selectedPlatforms.size === 0 || isPublishing) ? styles.btnPublishDisabled : ''}`}
                      onClick={handlePublish} disabled={!videoFile || selectedPlatforms.size === 0 || isPublishing}>
                      {isPublishing
                        ? <><span className={styles.spinner} />Publishing…</>
                        : publishMode === 'schedule'
                          ? `Schedule to ${selectedPlatforms.size} platform${selectedPlatforms.size !== 1 ? 's' : ''}`
                          : `Publish to ${selectedPlatforms.size} platform${selectedPlatforms.size !== 1 ? 's' : ''}`}
                    </button>
                    {selectedPlatforms.size === 0 && <span className={styles.publishHint}>Select at least one platform</span>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showSettings && (
        <SettingsModal settings={settings} onSave={(s) => { setSettings(s); saveSettings(s) }} onClose={() => setShowSettings(false)} />
      )}

      {/* ── Mobile bottom nav ── */}
      {videoFile && (
        <nav className={styles.bottomNav}>
          <button className={`${styles.bottomNavBtn} ${activeTab === 'captions' ? styles.bottomNavBtnActive : ''}`}
            onClick={() => setActiveTab('captions')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="5" width="18" height="14" rx="2"/><line x1="7" y1="10" x2="17" y2="10"/><line x1="7" y1="14" x2="13" y2="14"/>
            </svg>
            Captions
          </button>
          <button className={`${styles.bottomNavBtn} ${activeTab === 'publish' ? styles.bottomNavBtnActive : ''}`}
            onClick={() => setActiveTab('publish')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Publish
          </button>
        </nav>
      )}
    </div>
  )
}

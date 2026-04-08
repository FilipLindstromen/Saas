export type Platform = 'youtube' | 'instagram' | 'tiktok'

export interface PlatformAccount {
  platform: Platform
  displayName: string
  username?: string
  avatarUrl?: string
  accessToken: string
  userId?: string
  /** Instagram Business Account ID */
  igUserId?: string
}

export type PublishMode = 'now' | 'schedule'
export type YouTubePrivacy = 'public' | 'unlisted' | 'private'

export type JobStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error'

export interface PublishJob {
  platform: Platform
  status: JobStatus
  progress: number
  message: string
  url?: string
  error?: string
}

export interface AppSettings {
  youtubeClientId: string
  instagramAppId: string
  tiktokClientKey: string
}

// ── Caption types (from AutoCaptions) ──────────────────────────────────────

export interface CaptionWord {
  word: string
  start: number
  end: number
}

export interface CaptionSegment {
  start: number
  end: number
  text: string
  words?: CaptionWord[]
}

export type CaptionStyle =
  | 'lower-third'
  | 'centered-subtitle'
  | 'karaoke'
  | 'minimal'
  | 'bold-block'
  | 'word-by-word'
  | 'yellow-highlight'
  | 'outline'
  | 'box-top'
  | 'typewriter'

export type CaptionAnimation =
  | 'none'
  | 'fade'
  | 'fade-slide-left'
  | 'fade-slide-right'
  | 'fade-slide-up'
  | 'fade-slide-down'
  | 'scale-in'
  | 'scale-out'
  | 'slide-from-bottom'
  | 'bounce'

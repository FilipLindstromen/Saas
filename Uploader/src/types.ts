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

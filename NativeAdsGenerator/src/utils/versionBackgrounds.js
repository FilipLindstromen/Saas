import { COPY_VERSION_COUNT } from './copyVersions'
import { DEFAULT_MEDIA } from './adCompositor'

export const DEFAULT_VERSION_BACKGROUND = {
  backgroundColor: '#000000',
  mediaTransform: { ...DEFAULT_MEDIA },
  media: null,
}

export function createDefaultVersionBackgrounds(seed = {}) {
  return Array.from({ length: COPY_VERSION_COUNT }, (_, i) => ({
    backgroundColor: seed.backgroundColor ?? DEFAULT_VERSION_BACKGROUND.backgroundColor,
    mediaTransform: {
      ...DEFAULT_MEDIA,
      ...(i === 0 && seed.mediaTransform ? seed.mediaTransform : {}),
    },
    media: i === 0 ? (seed.media ?? null) : null,
  }))
}

export function normalizeVersionBackgrounds(saved, legacy = {}) {
  if (Array.isArray(saved) && saved.length === COPY_VERSION_COUNT) {
    return saved.map((slot) => ({
      backgroundColor: slot?.backgroundColor ?? DEFAULT_VERSION_BACKGROUND.backgroundColor,
      mediaTransform: {
        ...DEFAULT_MEDIA,
        ...(slot?.mediaTransform && typeof slot.mediaTransform === 'object' ? slot.mediaTransform : {}),
      },
      media: slot?.media ?? null,
    }))
  }

  return createDefaultVersionBackgrounds({
    backgroundColor: legacy.backgroundColor,
    mediaTransform: legacy.mediaTransform,
    media: legacy.media,
  })
}

export function versionHasBackground(slot) {
  return !!(slot?.media || (slot?.backgroundColor && slot.backgroundColor !== '#000000'))
}

export function getMediaBlobKey(versionIndex) {
  return `media-v${versionIndex}`
}

/** Migrate legacy single `media` blob key to version 0 */
export function migrateLegacyMediaRef(media) {
  if (!media) return null
  if (media.blobKey === 'media') {
    return { ...media, blobKey: getMediaBlobKey(0) }
  }
  return media
}

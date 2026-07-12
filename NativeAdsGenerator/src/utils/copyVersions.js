export const COPY_VERSION_COUNT = 5

export const DEFAULT_COPY_SLOT = {
  headline: 'Your headline here',
  copy: 'Supporting copy that explains the benefit and invites action.',
  linkTitle: 'Learn more',
}

export function createDefaultCopyVersions(seed = DEFAULT_COPY_SLOT) {
  return Array.from({ length: COPY_VERSION_COUNT }, (_, i) => ({
    headline: i === 0 ? seed.headline : '',
    copy: i === 0 ? seed.copy : '',
    linkTitle: seed.linkTitle || DEFAULT_COPY_SLOT.linkTitle,
  }))
}

export function normalizeCopyVersions(saved) {
  const legacy = {
    headline: saved?.headline || DEFAULT_COPY_SLOT.headline,
    copy: saved?.copy || DEFAULT_COPY_SLOT.copy,
    linkTitle: saved?.linkTitle || DEFAULT_COPY_SLOT.linkTitle,
  }

  let versions = saved?.copyVersions
  if (!Array.isArray(versions) || versions.length !== COPY_VERSION_COUNT) {
    versions = createDefaultCopyVersions(legacy)
  } else {
    versions = versions.map((slot, i) => ({
      headline: slot?.headline ?? (i === 0 ? legacy.headline : ''),
      copy: slot?.copy ?? (i === 0 ? legacy.copy : ''),
      linkTitle: slot?.linkTitle ?? DEFAULT_COPY_SLOT.linkTitle,
    }))
  }

  const activeCopyVersion = Math.min(
    Math.max(0, typeof saved?.activeCopyVersion === 'number' ? saved.activeCopyVersion : 0),
    COPY_VERSION_COUNT - 1
  )

  return { copyVersions: versions, activeCopyVersion }
}

export function getActiveCopy(text) {
  const { copyVersions, activeCopyVersion } = normalizeCopyVersions(text || {})
  const slot = copyVersions[activeCopyVersion]
  return {
    headline: slot?.headline || '',
    copy: slot?.copy || '',
    linkTitle: slot?.linkTitle || '',
  }
}

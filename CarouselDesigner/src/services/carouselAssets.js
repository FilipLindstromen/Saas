import { stripHtml } from '../carousel/limits'
import { generateImageSearchQuery, searchUnsplash } from './carouselAi'

export async function fillSlidesWithImages({
  slides,
  openaiKey,
  unsplashKey,
  visualTheme = 'cohesive modern editorial photography, muted tones',
  onProgress,
}) {
  if (!openaiKey?.trim() || !unsplashKey?.trim()) {
    throw new Error('OpenAI and Unsplash API keys are required.')
  }

  const targets = slides.filter(
    (s) => (s.layout || 'default') !== 'section'
      && (s.layout || 'default') !== 'video'
      && (!s.imageUrl || !s.imageUrl.trim())
  )

  if (!targets.length) return { slides, filled: 0, failed: 0 }

  const updated = [...slides]
  let filled = 0
  let failed = 0

  for (let i = 0; i < targets.length; i++) {
    const slide = targets[i]
    const idx = updated.findIndex((s) => s.id === slide.id)
    if (idx < 0) continue

    onProgress?.(`Finding image ${i + 1} of ${targets.length}…`)

    const text = [stripHtml(slide.content), stripHtml(slide.subtitle)].filter(Boolean).join(' ')
    if (!text.trim()) {
      failed++
      continue
    }

    try {
      const query = await generateImageSearchQuery(text, visualTheme)
      const imageUrl = await searchUnsplash(query, unsplashKey)
      if (imageUrl) {
        updated[idx] = {
          ...updated[idx],
          imageUrl,
          imageScale: 1.05,
          imagePositionX: 50,
          imagePositionY: 45,
          backgroundOpacity: updated[idx].backgroundOpacity ?? 0.6,
        }
        filled++
      } else {
        failed++
      }
    } catch {
      failed++
    }
  }

  return { slides: updated, filled, failed }
}

export function applyStylePresetToSlides(slides, preset) {
  if (!preset?.slideOverrides) return slides
  return slides.map((slide) => ({
    ...slide,
    ...preset.slideOverrides,
    ...(slide.role === 'cta' ? { textHeadingLevel: slide.textHeadingLevel || 'h1' } : {}),
  }))
}

export function applyStylePresetToSettings(settings, preset) {
  if (!preset?.settings) return settings
  return { ...settings, ...preset.settings }
}

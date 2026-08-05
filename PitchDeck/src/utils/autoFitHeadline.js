import { htmlToPlainText } from './slidePlainText'

/**
 * Scale H1 rem from character count and line count (Statement-style fit).
 */
export function computeAutoFitH1Rem(plainText, baseH1Rem, options = {}) {
  const minFactor = options.minFactor ?? 0.42
  const maxFactor = options.maxFactor ?? 1.12
  if (!plainText || !baseH1Rem) return baseH1Rem

  const trimmed = plainText.replace(/\s+/g, ' ').trim()
  const chars = trimmed.length
  const lines = plainText.split('\n').map((l) => l.trim()).filter(Boolean).length || 1

  let factor = 1
  if (chars <= 8) factor = maxFactor
  else if (chars <= 16) factor = 1.06
  else if (chars <= 32) factor = 0.92
  else if (chars <= 56) factor = 0.78
  else if (chars <= 90) factor = 0.65
  else factor = 0.52

  if (lines >= 3) factor *= 0.9
  if (lines >= 5) factor *= 0.88

  factor = Math.max(minFactor, Math.min(maxFactor, factor))
  return Math.round(baseH1Rem * factor * 100) / 100
}

export function shouldAutoFitSlideHeadline(slide) {
  if (slide?.autoFitHeadline === false) return false
  if (slide?.autoFitHeadline === true) return true
  const level = slide?.textHeadingLevel
  const archetype = slide?.textArchetype
  return level === 'h1' || archetype === 'statement' || archetype === 'stat'
}

export function resolveEffectiveH1Rem(slide, deckH1Rem) {
  if (!shouldAutoFitSlideHeadline(slide)) return deckH1Rem
  const plain = htmlToPlainText(slide?.content || '')
  if (!plain) return deckH1Rem
  return computeAutoFitH1Rem(plain, deckH1Rem)
}

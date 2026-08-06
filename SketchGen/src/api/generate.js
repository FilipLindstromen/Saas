import { editImage } from '@shared/openai'
import { fitDataUrlToSketchSize, getSketchFormat, normalizeSketchFormatId } from '../utils/canvasFormat'

function buildBrandDirective(brand, useBrandColors) {
  if (!useBrandColors || !brand?.colors) return ''
  const c = brand.colors
  const palette = [
    `background ${c.bg}`,
    `linework/outlines ${c.line}`,
    `primary brand ${c.main}`,
    `secondary ${c.secondary}`,
    `accent ${c.accent}`,
    `second accent ${c.accent2}`,
    `text and label color ${c.text}`,
  ].join(', ')
  const fonts = brand.fonts
  const fontNote = fonts?.headline && fonts?.body && fonts?.accent
    ? ` For any typography, use "${fonts.headline}" for headlines, "${fonts.body}" for body text and labels, and "${fonts.accent}" for accent callouts (Google Font styles).`
    : fonts?.headline && fonts?.body
      ? ` For any typography, use "${fonts.headline}" for headlines and "${fonts.body}" for body text and labels (Google Font styles).`
      : ''
  return ` Use this brand color palette throughout the illustration where color applies: ${palette}. Prefer these colors over arbitrary ones unless instructions explicitly override.${fontNote}`
}

/**
 * Build the image-edit prompt from a style preset and optional free-text instructions.
 */
export function buildPrompt(style, instructions, formatId, brand, useBrandColors) {
  const format = getSketchFormat(formatId)
  const aspectNote = `The finished image must keep the exact same aspect ratio and framing as the sketch (${format.label}, ${format.width}×${format.height}). Do not crop to a different shape.`
  const brandNote = buildBrandDirective(brand, useBrandColors)
  const extra = instructions?.trim() ? ` Additional instructions from the artist: ${instructions.trim()}` : ''
  if (style.type === 'image') {
    return `Convert this rough sketch into a finished illustration. Preserve the exact composition, proportions, subject matter, and layout of the sketch — do not add, remove, or move elements. ${aspectNote} The second attached image is a style reference — match its visual style: color palette, linework, rendering technique, and overall mood.${brandNote}${extra}`
  }
  const base = `Convert this rough sketch into a finished illustration. Preserve the exact composition, proportions, subject matter, and layout of the sketch — do not add, remove, or move elements. ${aspectNote} Render it in the following style: ${style.prompt}.${brandNote}`
  return base + extra
}

/**
 * Prompt for iterating on an already-generated illustration (Improve generation).
 */
export function buildImprovePrompt(style, instructions, formatId, brand, useBrandColors) {
  const format = getSketchFormat(formatId)
  const aspectNote = `Keep the exact same aspect ratio and framing (${format.label}, ${format.width}×${format.height}). Do not crop to a different shape.`
  const brandNote = buildBrandDirective(brand, useBrandColors)
  const artist = instructions?.trim() || 'Refine and improve this illustration.'
  if (style.type === 'image') {
    return `Edit this finished illustration according to the artist's instructions. Preserve composition, proportions, and subject matter unless the instructions explicitly ask to change them. ${aspectNote} Keep consistency with the attached style reference where appropriate.${brandNote} Artist instructions: ${artist}`
  }
  const styleNote = style.prompt
    ? ` Maintain the overall look: ${style.prompt}.`
    : ''
  return `Edit this finished illustration according to the artist's instructions. Preserve composition, proportions, and subject matter unless the instructions explicitly ask to change them. ${aspectNote}${styleNote}${brandNote} Artist instructions: ${artist}`
}

/**
 * Generate a styled illustration from a sketch data URL, or refine a prior generation
 * when referenceImageDataUrl is set (Improve generation).
 */
export async function generateStyledImage({
  sketchDataUrl,
  style,
  instructions,
  formatId = '16:9',
  referenceImageDataUrl = null,
  brand = null,
  useBrandColors = false,
  quality = 'high',
  signal = null,
}) {
  const format = getSketchFormat(normalizeSketchFormatId(formatId))
  const improving = Boolean(referenceImageDataUrl)
  const prompt = improving
    ? buildImprovePrompt(style, instructions, format.id, brand, useBrandColors)
    : buildPrompt(style, instructions, format.id, brand, useBrandColors)
  const primaryImage = improving ? referenceImageDataUrl : sketchDataUrl
  const raw = await editImage({
    prompt,
    imageDataUrl: primaryImage,
    additionalImages: style.type === 'image' ? [style.referenceImageDataUrl] : [],
    size: format.apiSize,
    quality: quality === 'low' ? 'low' : 'high',
    signal,
  })
  return fitDataUrlToSketchSize(raw, format.width, format.height)
}

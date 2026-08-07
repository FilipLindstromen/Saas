import { editImage } from '@shared/openai'
import { fitDataUrlToSketchSize, getSketchFormat, normalizeSketchFormatId, GENERATION_SAFE_ZONE_INSET } from '../utils/canvasFormat'
import { createLocalImageVariants } from '../utils/localImageVariants'

function buildBrandDirective(brand, useBrandColors) {
  if (!useBrandColors || !brand?.colors) return ''
  const c = brand.colors
  const palette = [
    `primary ${c.primary}`,
    `secondary ${c.secondary}`,
    `tertiary ${c.tertiary}`,
    `accent ${c.accent}`,
    `background ${c.background}`,
    `border and linework ${c.border}`,
    `text ${c.text}`,
  ].join(', ')
  const fonts = brand.fonts
  const fontNote = fonts?.headline && fonts?.body && fonts?.accent
    ? ` For any typography, use "${fonts.headline}" for headlines, "${fonts.body}" for body text and labels, and "${fonts.accent}" for accent callouts (Google Font styles).`
    : fonts?.headline && fonts?.body
      ? ` For any typography, use "${fonts.headline}" for headlines and "${fonts.body}" for body text and labels (Google Font styles).`
      : ''
  return ` Use this brand color palette throughout the illustration where color applies: ${palette}. Prefer these colors over arbitrary ones unless instructions explicitly override.${fontNote}`
}

/** Ensures the model keeps all artwork inside the output frame (avoids clipped titles/graphics). */
export function buildSafeCompositionNote() {
  const pct = Math.round(GENERATION_SAFE_ZONE_INSET * 100)
  return (
    'Critical composition rule: the entire finished illustration must fit completely inside the image rectangle — nothing may be clipped or cut off. '
    + `Keep all titles, body text, labels, icons, charts, tables, and decorative graphics fully visible with at least ${pct}% clear margin from every edge (top, bottom, left, right). `
    + 'If the layout is tight, scale the whole design down uniformly so everything stays inside the frame. '
    + 'Do not place text or graphics outside the canvas, past card/panel borders, or so close to edges that they would be cropped.'
  )
}

function multiVariantPromptNote(variantCount) {
  if (variantCount <= 1) return ''
  return ` Produce ${variantCount} clearly distinct visual interpretations (color, rendering, or mood) while keeping the same composition, layout, and subject matter as the sketch.`
}

/**
 * Build the image-edit prompt from a style preset and optional free-text instructions.
 */
export function buildPrompt(style, instructions, formatId, brand, useBrandColors, variantCount = 1) {
  const format = getSketchFormat(formatId)
  const aspectNote = `The finished image must keep the exact same aspect ratio and framing as the sketch (${format.label}, ${format.width}×${format.height}). Do not crop to a different shape.`
  const boundsNote = buildSafeCompositionNote()
  const brandNote = buildBrandDirective(brand, useBrandColors)
  const variantNote = multiVariantPromptNote(variantCount)
  const extra = instructions?.trim() ? ` Additional instructions from the artist: ${instructions.trim()}` : ''
  if (style.type === 'image') {
    return `Convert this rough sketch into a finished illustration. Preserve the exact composition, proportions, subject matter, and layout of the sketch — do not add, remove, or move elements. ${aspectNote} ${boundsNote} The second attached image is a style reference — match its visual style: color palette, linework, rendering technique, and overall mood.${brandNote}${variantNote}${extra}`
  }
  const base = `Convert this rough sketch into a finished illustration. Preserve the exact composition, proportions, subject matter, and layout of the sketch — do not add, remove, or move elements. ${aspectNote} ${boundsNote} Render it in the following style: ${style.prompt}.${brandNote}${variantNote}`
  return base + extra
}

/**
 * Prompt for iterating on an already-generated illustration (Improve generation).
 */
export function buildImprovePrompt(style, instructions, formatId, brand, useBrandColors, variantCount = 1) {
  const format = getSketchFormat(formatId)
  const aspectNote = `Keep the exact same aspect ratio and framing (${format.label}, ${format.width}×${format.height}). Do not crop to a different shape.`
  const boundsNote = buildSafeCompositionNote()
  const brandNote = buildBrandDirective(brand, useBrandColors)
  const variantNote = multiVariantPromptNote(variantCount)
  const artist = instructions?.trim() || 'Refine and improve this illustration.'
  if (style.type === 'image') {
    return `Edit this finished illustration according to the artist's instructions. Preserve composition, proportions, and subject matter unless the instructions explicitly ask to change them. ${aspectNote} ${boundsNote} Keep consistency with the attached style reference where appropriate.${brandNote}${variantNote} Artist instructions: ${artist}`
  }
  const styleNote = style.prompt
    ? ` Maintain the overall look: ${style.prompt}.`
    : ''
  return `Edit this finished illustration according to the artist's instructions. Preserve composition, proportions, and subject matter unless the instructions explicitly ask to change them. ${aspectNote} ${boundsNote}${styleNote}${brandNote}${variantNote} Artist instructions: ${artist}`
}

async function fitVariantOutputs(raw, format, background) {
  const list = Array.isArray(raw) ? raw : [raw]
  return Promise.all(list.map((url) => fitDataUrlToSketchSize(url, format.width, format.height, background)))
}

/**
 * Generate styled illustration(s). When variantCount > 1, uses one edits API call (n=variantCount)
 * and pads with local canvas variants if the API returns fewer images than requested.
 * @returns {Promise<string|string[]>}
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
  variantCount = 1,
  signal = null,
}) {
  const format = getSketchFormat(normalizeSketchFormatId(formatId))
  const count = Math.min(3, Math.max(1, Math.floor(variantCount) || 1))
  const improving = Boolean(referenceImageDataUrl)
  const prompt = improving
    ? buildImprovePrompt(style, instructions, format.id, brand, useBrandColors, count)
    : buildPrompt(style, instructions, format.id, brand, useBrandColors, count)
  const primaryImage = improving ? referenceImageDataUrl : sketchDataUrl
  const bg = brand?.colors?.background ?? '#ffffff'
  const raw = await editImage({
    prompt,
    imageDataUrl: primaryImage,
    additionalImages: style.type === 'image' ? [style.referenceImageDataUrl] : [],
    size: format.apiSize,
    quality: quality === 'low' ? 'low' : 'high',
    n: count,
    signal,
  })

  let fitted = await fitVariantOutputs(raw, format, bg)

  if (count > 1 && fitted.length < count && fitted.length > 0) {
    const local = await createLocalImageVariants(fitted[0], count - fitted.length, {
      width: format.width,
      height: format.height,
    })
    fitted = [...fitted, ...local]
  }

  if (count === 1) return fitted[0]
  return fitted.slice(0, count)
}

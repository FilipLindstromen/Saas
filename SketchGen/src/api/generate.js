import { editImage } from '@shared/openai'
import { fitDataUrlToSketchSize, getSketchFormat, normalizeSketchFormatId } from '../utils/canvasFormat'

/**
 * Build the image-edit prompt from a style preset and optional free-text instructions.
 */
export function buildPrompt(style, instructions, formatId) {
  const format = getSketchFormat(formatId)
  const aspectNote = `The finished image must keep the exact same aspect ratio and framing as the sketch (${format.label}, ${format.width}×${format.height}). Do not crop to a different shape.`
  const extra = instructions?.trim() ? ` Additional instructions from the artist: ${instructions.trim()}` : ''
  if (style.type === 'image') {
    return `Convert this rough sketch into a finished illustration. Preserve the exact composition, proportions, subject matter, and layout of the sketch — do not add, remove, or move elements. ${aspectNote} The second attached image is a style reference — match its visual style: color palette, linework, rendering technique, and overall mood.${extra}`
  }
  const base = `Convert this rough sketch into a finished illustration. Preserve the exact composition, proportions, subject matter, and layout of the sketch — do not add, remove, or move elements. ${aspectNote} Render it in the following style: ${style.prompt}.`
  return base + extra
}

/**
 * Prompt for iterating on an already-generated illustration (Improve generation).
 */
export function buildImprovePrompt(style, instructions, formatId) {
  const format = getSketchFormat(formatId)
  const aspectNote = `Keep the exact same aspect ratio and framing (${format.label}, ${format.width}×${format.height}). Do not crop to a different shape.`
  const artist = instructions?.trim() || 'Refine and improve this illustration.'
  if (style.type === 'image') {
    return `Edit this finished illustration according to the artist's instructions. Preserve composition, proportions, and subject matter unless the instructions explicitly ask to change them. ${aspectNote} Keep consistency with the attached style reference where appropriate. Artist instructions: ${artist}`
  }
  const styleNote = style.prompt
    ? ` Maintain the overall look: ${style.prompt}.`
    : ''
  return `Edit this finished illustration according to the artist's instructions. Preserve composition, proportions, and subject matter unless the instructions explicitly ask to change them. ${aspectNote}${styleNote} Artist instructions: ${artist}`
}

/**
 * Generate a styled illustration from a sketch data URL, or refine a prior generation
 * when referenceImageDataUrl is set (Improve generation).
 */
export async function generateStyledImage({ sketchDataUrl, style, instructions, formatId = '16:9', referenceImageDataUrl = null }) {
  const format = getSketchFormat(normalizeSketchFormatId(formatId))
  const improving = Boolean(referenceImageDataUrl)
  const prompt = improving
    ? buildImprovePrompt(style, instructions, format.id)
    : buildPrompt(style, instructions, format.id)
  const primaryImage = improving ? referenceImageDataUrl : sketchDataUrl
  const raw = await editImage({
    prompt,
    imageDataUrl: primaryImage,
    additionalImages: style.type === 'image' ? [style.referenceImageDataUrl] : [],
    size: format.apiSize,
    quality: 'high',
  })
  return fitDataUrlToSketchSize(raw, format.width, format.height)
}

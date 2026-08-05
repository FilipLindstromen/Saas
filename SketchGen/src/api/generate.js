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
 * Generate a styled illustration from a sketch data URL.
 */
export async function generateStyledImage({ sketchDataUrl, style, instructions, formatId = '16:9' }) {
  const format = getSketchFormat(normalizeSketchFormatId(formatId))
  const prompt = buildPrompt(style, instructions, format.id)
  const raw = await editImage({
    prompt,
    imageDataUrl: sketchDataUrl,
    additionalImages: style.type === 'image' ? [style.referenceImageDataUrl] : [],
    size: format.apiSize,
    quality: 'high',
  })
  return fitDataUrlToSketchSize(raw, format.width, format.height)
}

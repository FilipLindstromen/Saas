import { editImage } from '@shared/openai'

/**
 * Build the image-edit prompt from a style preset and optional free-text instructions.
 * Text-prompt styles and image-reference styles need different phrasing since the
 * latter also has an actual reference photo attached (see generateStyledImage).
 */
export function buildPrompt(style, instructions) {
  const extra = instructions?.trim() ? ` Additional instructions from the artist: ${instructions.trim()}` : ''
  if (style.type === 'image') {
    return `Convert this rough sketch into a finished illustration. Preserve the exact composition, proportions, subject matter, and layout of the sketch — do not add, remove, or move elements. The second attached image is a style reference — match its visual style: color palette, linework, rendering technique, and overall mood.${extra}`
  }
  const base = `Convert this rough sketch into a finished illustration. Preserve the exact composition, proportions, subject matter, and layout of the sketch — do not add, remove, or move elements. Render it in the following style: ${style.prompt}.`
  return base + extra
}

/**
 * Generate a styled illustration from a sketch data URL.
 * @param {Object} options
 * @param {string} options.sketchDataUrl - the sketch, exported as a PNG data URL
 * @param {Object} options.style - a text style from constants/styles.js, a custom
 *   text style, or an uploaded image-reference style ({ type: 'image', referenceImageDataUrl })
 * @param {string} [options.instructions] - optional free-text instructions
 * @returns {Promise<string>} data URL of the generated image
 */
export async function generateStyledImage({ sketchDataUrl, style, instructions }) {
  const prompt = buildPrompt(style, instructions)
  return editImage({
    prompt,
    imageDataUrl: sketchDataUrl,
    additionalImages: style.type === 'image' ? [style.referenceImageDataUrl] : [],
    size: '1024x1024',
    quality: 'high',
  })
}

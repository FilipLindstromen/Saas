import { editImage } from '@shared/openai'

/**
 * Build the image-edit prompt from a style preset and optional free-text instructions.
 */
export function buildPrompt(style, instructions) {
  const base = `Convert this rough sketch into a finished illustration. Preserve the exact composition, proportions, subject matter, and layout of the sketch — do not add, remove, or move elements. Render it in the following style: ${style.prompt}.`
  const extra = instructions?.trim() ? ` Additional instructions from the artist: ${instructions.trim()}` : ''
  return base + extra
}

/**
 * Generate a styled illustration from a sketch data URL.
 * @param {Object} options
 * @param {string} options.sketchDataUrl - the sketch, exported as a PNG data URL
 * @param {Object} options.style - one of STYLES from constants/styles.js
 * @param {string} [options.instructions] - optional free-text instructions
 * @returns {Promise<string>} data URL of the generated image
 */
export async function generateStyledImage({ sketchDataUrl, style, instructions }) {
  const prompt = buildPrompt(style, instructions)
  return editImage({
    prompt,
    imageDataUrl: sketchDataUrl,
    size: '1024x1024',
    quality: 'high',
  })
}

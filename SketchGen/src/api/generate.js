import { editImage, generateImage } from '@shared/openai'
import {
  createBlankCanvasDataUrl,
  DEFAULT_SKETCH_FORMAT_ID,
  fitDataUrlToSketchSize,
  getSketchFormat,
  normalizeSketchFormatId,
  GENERATION_SAFE_ZONE_INSET,
} from '../utils/canvasFormat'
import { createLocalImageVariants } from '../utils/localImageVariants'
import {
  BRAND_BACKGROUND_COLOR_FIELDS,
  normalizeBrandColors,
  normalizeBrandFonts,
  normalizeHexColor,
} from '../constants/brand'

function buildBrandDirective(brand, useBrandColors, documentBackgroundHex) {
  if (!useBrandColors || !brand?.colors) return ''
  const c = normalizeBrandColors(brand.colors)
  const palette = [
    `primary ${c.primary}`,
    `secondary ${c.secondary}`,
    `tertiary ${c.tertiary}`,
    `accent ${c.accent}`,
    `bright background ${c.brightBg}`,
    `dark background ${c.darkBg}`,
    `colored background ${c.coloredBg}`,
    `border and linework ${c.border}`,
    `text ${c.text}`,
  ].join(', ')
  const fonts = normalizeBrandFonts(brand.fonts)
  const fontNote = fonts.headline && fonts.body && fonts.accent
    ? ` For typography, use "${fonts.headline}" for headlines, "${fonts.body}" for body text and labels, and "${fonts.accent}" for accent callouts (Google Font styles).`
    : fonts.headline && fonts.body
      ? ` For typography, use "${fonts.headline}" for headlines and "${fonts.body}" for body text and labels (Google Font styles).`
      : ''

  let canvasBgNote = ''
  const docBg = documentBackgroundHex
    ? normalizeHexColor(documentBackgroundHex, c.brightBg)
    : null
  if (docBg) {
    const role = BRAND_BACKGROUND_COLOR_FIELDS.find(
      ({ key }) => c[key]?.toLowerCase() === docBg.toLowerCase()
    )
    canvasBgNote = role
      ? ` The main canvas/slide background must be ${docBg} (brand ${role.label}).`
      : ` The main canvas/slide background must be ${docBg}.`
  }

  return (
    ' MANDATORY BRAND PALETTE — you must color the finished illustration using only these exact hex values'
    + ` for backgrounds, fills, accents, typography, icons, and charts: ${palette}.${canvasBgNote}`
    + ' Do not introduce other hues unless the artist instructions explicitly require a specific different color.'
    + fontNote
  )
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

function multiVariantInstructionsNote(variantCount) {
  if (variantCount <= 1) return ''
  return ` Produce ${variantCount} clearly distinct visual interpretations (color, rendering, or mood) while fulfilling the same brief.`
}

/**
 * Build the image-edit prompt from a style preset and optional free-text instructions.
 */
export function buildPrompt(style, instructions, formatId, brand, useBrandColors, variantCount = 1, documentBackgroundHex = null) {
  const format = getSketchFormat(formatId)
  const aspectNote = `The finished image must keep the exact same aspect ratio and framing as the sketch (${format.label}, ${format.width}×${format.height}). Do not crop to a different shape.`
  const boundsNote = buildSafeCompositionNote()
  const brandNote = buildBrandDirective(brand, useBrandColors, documentBackgroundHex)
  const variantNote = multiVariantPromptNote(variantCount)
  const extra = instructions?.trim() ? ` Additional instructions from the artist: ${instructions.trim()}` : ''
  if (style.type === 'image') {
    const styleRefNote = useBrandColors
      ? ' The second attached image is a style reference — match its linework, rendering technique, and mood, but apply the mandatory brand hex palette for all color choices (not the reference image colors).'
      : ' The second attached image is a style reference — match its visual style: color palette, linework, rendering technique, and overall mood.'
    return `Convert this rough sketch into a finished illustration. Preserve the exact composition, proportions, subject matter, and layout of the sketch — do not add, remove, or move elements. ${aspectNote} ${boundsNote}${styleRefNote}${brandNote}${variantNote}${extra}`
  }
  const base = `Convert this rough sketch into a finished illustration. Preserve the exact composition, proportions, subject matter, and layout of the sketch — do not add, remove, or move elements. ${aspectNote} ${boundsNote} Render it in the following style: ${style.prompt}.${brandNote}${variantNote}`
  return base + extra
}

/**
 * Prompt for iterating on an already-generated illustration (Improve generation).
 */
export function buildImprovePrompt(style, instructions, formatId, brand, useBrandColors, variantCount = 1, documentBackgroundHex = null) {
  const format = getSketchFormat(formatId)
  const aspectNote = `Keep the exact same aspect ratio and framing (${format.label}, ${format.width}×${format.height}). Do not crop to a different shape.`
  const boundsNote = buildSafeCompositionNote()
  const brandNote = buildBrandDirective(brand, useBrandColors, documentBackgroundHex)
  const variantNote = multiVariantPromptNote(variantCount)
  const artist = instructions?.trim() || 'Refine and improve this illustration.'
  if (style.type === 'image') {
    const styleRefNote = useBrandColors
      ? ' Keep consistency with the attached style reference for technique and mood, but recolor using the mandatory brand hex palette when colors change.'
      : ' Keep consistency with the attached style reference where appropriate.'
    return `Edit this finished illustration according to the artist's instructions. Preserve composition, proportions, and subject matter unless the instructions explicitly ask to change them. ${aspectNote} ${boundsNote}${styleRefNote}${brandNote}${variantNote} Artist instructions: ${artist}`
  }
  const styleNote = style.prompt
    ? ` Maintain the overall look: ${style.prompt}.`
    : ''
  return `Edit this finished illustration according to the artist's instructions. Preserve composition, proportions, and subject matter unless the instructions explicitly ask to change them. ${aspectNote} ${boundsNote}${styleNote}${brandNote}${variantNote} Artist instructions: ${artist}`
}

/**
 * Text-only generation when the sketch canvas is empty — uses instructions + style (no layout to preserve).
 */
export function buildInstructionsOnlyPrompt(
  style,
  instructions,
  formatId,
  brand,
  useBrandColors,
  variantCount = 1,
  documentBackgroundHex = null,
) {
  const format = getSketchFormat(formatId)
  const artist = instructions?.trim()
  if (!artist) throw new Error('Instructions are required when the canvas is empty.')
  const aspectNote = `The illustration must fit a ${format.label} frame (${format.width}×${format.height} pixel proportions).`
  const boundsNote = buildSafeCompositionNote()
  const brandNote = buildBrandDirective(brand, useBrandColors, documentBackgroundHex)
  const variantNote = multiVariantInstructionsNote(variantCount)
  if (style.type === 'image') {
    const styleRefNote = useBrandColors
      ? ' The attached image is a style reference — match its linework, rendering technique, and mood, but apply the mandatory brand hex palette for all colors (not the reference colors).'
      : ' The attached image is a style reference — match its visual style: color palette, linework, rendering technique, and overall mood.'
    return `Create a finished illustration from scratch based on the artist's instructions. There is no sketch — invent composition, layout, and subject matter from the brief. ${aspectNote} ${boundsNote}${styleRefNote}${brandNote}${variantNote} Artist instructions: ${artist}`
  }
  return `Create a finished illustration from scratch based on the artist's instructions. There is no sketch — invent composition, layout, and subject matter from the brief. ${aspectNote} ${boundsNote} Render in this style: ${style.prompt}.${brandNote}${variantNote} Artist instructions: ${artist}`
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
  formatId = DEFAULT_SKETCH_FORMAT_ID,
  referenceImageDataUrl = null,
  brand = null,
  useBrandColors = false,
  documentBackgroundColor = null,
  instructionsOnly = false,
  quality = 'high',
  variantCount = 1,
  signal = null,
}) {
  const format = getSketchFormat(normalizeSketchFormatId(formatId))
  const count = Math.min(3, Math.max(1, Math.floor(variantCount) || 1))
  const improving = Boolean(referenceImageDataUrl)
  const fromInstructions = Boolean(instructionsOnly && !improving)
  const normalizedBrand = brand
    ? { colors: normalizeBrandColors(brand.colors), fonts: normalizeBrandFonts(brand.fonts) }
    : null
  const docBg = useBrandColors && documentBackgroundColor
    ? normalizeHexColor(documentBackgroundColor, normalizedBrand?.colors?.brightBg ?? '#ffffff')
    : null
  const fitBg = useBrandColors
    ? (docBg ?? normalizedBrand?.colors?.brightBg ?? '#ffffff')
    : (normalizedBrand?.colors?.brightBg ?? '#ffffff')
  const qualityVal = quality === 'low' ? 'low' : 'high'

  let raw
  if (fromInstructions) {
    const prompt = buildInstructionsOnlyPrompt(
      style,
      instructions,
      format.id,
      normalizedBrand,
      useBrandColors,
      count,
      docBg,
    )
    if (style.type === 'image' && style.referenceImageDataUrl) {
      const blank = createBlankCanvasDataUrl(format.width, format.height, fitBg)
      if (!blank) throw new Error('Could not prepare canvas for generation.')
      raw = await editImage({
        prompt,
        imageDataUrl: blank,
        additionalImages: [style.referenceImageDataUrl],
        size: format.apiSize,
        quality: qualityVal,
        n: count,
        signal,
      })
    } else {
      raw = await generateImage({
        prompt,
        size: format.apiSize,
        quality: qualityVal,
        n: count,
        signal,
      })
    }
  } else {
    const prompt = improving
      ? buildImprovePrompt(style, instructions, format.id, normalizedBrand, useBrandColors, count, docBg)
      : buildPrompt(style, instructions, format.id, normalizedBrand, useBrandColors, count, docBg)
    const primaryImage = improving ? referenceImageDataUrl : sketchDataUrl
    if (!primaryImage) throw new Error('Sketch image is required.')
    raw = await editImage({
      prompt,
      imageDataUrl: primaryImage,
      additionalImages: style.type === 'image' ? [style.referenceImageDataUrl] : [],
      size: format.apiSize,
      quality: qualityVal,
      n: count,
      signal,
    })
  }

  let fitted = await fitVariantOutputs(raw, format, fitBg)

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

import { editImage, generateImage } from '@shared/openai'
import { getExportCanvasSize } from '../utils/slideFormats'

export const BACKGROUND_STYLE_PRESETS = [
  {
    id: 'infographic',
    label: 'Infographic',
    hint: 'Clean charts, diagrams, icons, and data-inspired shapes without readable text.',
  },
  {
    id: 'realistic',
    label: 'Realistic',
    hint: 'Natural photography, authentic textures, believable lighting and depth of field.',
  },
  {
    id: 'informational',
    label: 'Informational',
    hint: 'Clear, educational visuals with structured composition and calm, readable areas.',
  },
  {
    id: 'iconic',
    label: 'Iconic',
    hint: 'Bold symbols, simplified shapes, strong silhouettes, and memorable focal points.',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    hint: 'Uncluttered layout, soft gradients, and generous negative space for slide copy.',
  },
  {
    id: 'abstract',
    label: 'Abstract',
    hint: 'Color fields, textures, and geometric forms without literal subjects.',
  },
]

const LEGACY_STYLE_MAP = {
  cinematic: 'realistic',
  editorial: 'informational',
  bold: 'iconic',
  photo: 'realistic',
}

export function normalizeBackgroundStyleId(styleId) {
  if (!styleId) return 'informational'
  if (BACKGROUND_STYLE_PRESETS.some((item) => item.id === styleId)) return styleId
  return LEGACY_STYLE_MAP[styleId] || 'informational'
}

export function stripSlideHtml(html) {
  return (html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

export async function resolveImageToDataUrl(imageUrl) {
  if (!imageUrl) return null
  if (imageUrl.startsWith('data:')) return imageUrl

  const response = await fetch(imageUrl)
  if (!response.ok) throw new Error('Could not load the reference image.')

  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export function getSlideText(slide) {
  const content = stripSlideHtml(slide?.content)
  const subtitle = stripSlideHtml(slide?.subtitle)
  return content || subtitle || ''
}

export function getImageSizeForSlideFormat(slideFormat) {
  switch (slideFormat) {
    case '1:1':
      return '1024x1024'
    case '9:16':
    case '3:4':
      return '1024x1536'
    case '16:9':
    default:
      return '1536x1024'
  }
}

export function buildBackgroundPrompt({
  instructions = '',
  styleId = 'informational',
  styleNotes = '',
  slideText = '',
  useSlideText = true,
  slideFormat = '16:9',
}) {
  const preset = BACKGROUND_STYLE_PRESETS.find((item) => item.id === normalizeBackgroundStyleId(styleId))
    || BACKGROUND_STYLE_PRESETS[0]
  const styleDescription = styleNotes.trim() || preset.hint

  const parts = [
    'Create a presentation slide background image.',
    'Do not include any text, letters, numbers, logos, watermarks, or UI elements.',
    'Leave readable areas where slide copy can sit on top.',
    `Visual style: ${preset.label}. ${styleDescription}`,
  ]

  if (instructions.trim()) {
    parts.push(`Creative direction: ${instructions.trim()}.`)
  }

  if (useSlideText && slideText.trim()) {
    parts.push(
      `The slide message is "${slideText.trim()}". Visualize this theme and mood without writing any words.`
    )
  }

  const { w, h } = getExportCanvasSize(slideFormat)
  parts.push(`Composition should work as a ${w}x${h} slide background.`)

  return parts.join(' ')
}

export async function generateSlideBackground({
  instructions,
  styleId,
  styleNotes,
  slideText,
  useSlideText,
  referenceImageDataUrl,
  slideFormat = '16:9',
  apiKey,
}) {
  const prompt = buildBackgroundPrompt({
    instructions,
    styleId,
    styleNotes,
    slideText,
    useSlideText,
    slideFormat,
  })
  const size = getImageSizeForSlideFormat(slideFormat)
  const options = { prompt, size, apiKey }

  if (referenceImageDataUrl) {
    return editImage({ ...options, imageDataUrl: referenceImageDataUrl })
  }

  return generateImage(options)
}

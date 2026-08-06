/**
 * Persists tool/generation settings that aren't tied to any specific drawing —
 * pen tool, color, pen/eraser sizes, smoothing/wobble, zoom, canvas format,
 * selected style, instructions, variation count, and UI toggles. These carry over
 * when switching drawings/tabs and across page reloads.
 */
import { normalizeSketchFormatId } from './canvasFormat'
import {
  DEFAULT_BRAND_COLORS,
  DEFAULT_BRAND_FONTS,
  GOOGLE_FONT_OPTIONS,
  normalizeBrandColors,
  normalizeBrandFonts,
  normalizeHexColor,
} from '../constants/brand'
import { normalizeArrowStyleId } from '../constants/arrowStyles'
import { normalizeGenerationQuality } from '../utils/generationCost'

const STORAGE_KEY = 'sketchgen-app-settings'

const DEFAULTS = {
  tool: 'pen',
  color: '#1a1a1a',
  penSize: 6,
  eraserSize: 12,
  smoothing: 0,
  wobble: 0,
  zoom: 1,
  canvasFormat: '16:9',
  selectedStyleId: null,
  instructions: '',
  variations: 1,
  styleSectionCollapsed: false,
  improveGeneration: false,
  brandColors: { ...DEFAULT_BRAND_COLORS },
  brandFonts: { ...DEFAULT_BRAND_FONTS },
  useBrandColorsInGeneration: false,
  textFontFamily: DEFAULT_BRAND_FONTS.body,
  textFontSize: 36,
  textFontBold: false,
  arrowStyleId: 'straight',
  penSnapHV: false,
  generationQuality: 'high',
  addGenerationsAsLayers: true,
  canvasBackgroundColor: DEFAULT_BRAND_COLORS.bg,
}

const VALID_TOOLS = new Set([
  'pen', 'eraser', 'text', 'fill', 'line', 'arrow', 'rect', 'circle', 'blur', 'move', 'stamp',
])

export function loadAppSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULTS }
    const merged = { ...DEFAULTS, ...parsed }
    // Migrate legacy single `size` field to separate pen/eraser sizes.
    if (parsed.size != null && parsed.penSize == null && parsed.eraserSize == null) {
      merged.penSize = parsed.size
      merged.eraserSize = parsed.size
    }
    delete merged.size
    if (!VALID_TOOLS.has(merged.tool)) merged.tool = DEFAULTS.tool
    merged.penSize = clampInt(merged.penSize, 1, 60, DEFAULTS.penSize)
    merged.eraserSize = clampInt(merged.eraserSize, 1, 60, DEFAULTS.eraserSize)
    merged.smoothing = clampNum(merged.smoothing, 0, 1, DEFAULTS.smoothing)
    merged.wobble = clampNum(merged.wobble, 0, 1, DEFAULTS.wobble)
    merged.zoom = clampNum(merged.zoom, 0.5, 3, DEFAULTS.zoom)
    merged.canvasFormat = normalizeSketchFormatId(merged.canvasFormat)
    merged.variations = clampInt(merged.variations, 1, 3, DEFAULTS.variations)
    merged.styleSectionCollapsed = Boolean(merged.styleSectionCollapsed)
    merged.improveGeneration = Boolean(merged.improveGeneration)
    merged.useBrandColorsInGeneration = Boolean(merged.useBrandColorsInGeneration)
    merged.brandColors = normalizeBrandColors(merged.brandColors)
    merged.brandFonts = normalizeBrandFonts(merged.brandFonts)
    merged.textFontSize = clampInt(merged.textFontSize, 8, 120, DEFAULTS.textFontSize)
    merged.textFontBold = Boolean(merged.textFontBold)
    merged.textFontFamily = GOOGLE_FONT_OPTIONS.includes(merged.textFontFamily)
      ? merged.textFontFamily
      : merged.brandFonts.body
    merged.arrowStyleId = normalizeArrowStyleId(merged.arrowStyleId)
    merged.generationQuality = normalizeGenerationQuality(merged.generationQuality)
    merged.addGenerationsAsLayers = merged.addGenerationsAsLayers !== false
    merged.penSnapHV = Boolean(merged.penSnapHV)
    merged.canvasBackgroundColor = normalizeHexColor(merged.canvasBackgroundColor, DEFAULTS.canvasBackgroundColor)
    if (typeof merged.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(merged.color)) {
      merged.color = DEFAULTS.color
    }
    return merged
  } catch {
    return { ...DEFAULTS }
  }
}

function clampInt(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function clampNum(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export function saveAppSettings(values) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values))
  } catch {
    // ignore quota errors — this is small text/number data, failing soft is fine
  }
}

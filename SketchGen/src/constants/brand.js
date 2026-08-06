/** Default brand palette (7 roles — bg, line, main, secondary, accent, accent2, text). */
export const DEFAULT_BRAND_COLORS = {
  bg: '#ffffff',
  line: '#1a1a1a',
  main: '#1971c2',
  secondary: '#495057',
  accent: '#ff6b35',
  accent2: '#9c36b5',
  text: '#212529',
}

export const BRAND_COLOR_FIELDS = [
  { key: 'bg', label: 'Background' },
  { key: 'line', label: 'Line' },
  { key: 'main', label: 'Main' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'accent', label: 'Accent' },
  { key: 'accent2', label: 'Accent 2' },
  { key: 'text', label: 'Text' },
]

export const DEFAULT_BRAND_FONTS = {
  headline: 'Montserrat',
  body: 'Inter',
  accent: 'Poppins',
}

export const BRAND_FONT_ROLES = [
  { key: 'headline', label: 'Headline' },
  { key: 'body', label: 'Body' },
  { key: 'accent', label: 'Accent' },
]

/** Curated Google Fonts for brand typography in generations. */
export const GOOGLE_FONT_OPTIONS = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Nunito',
  'Raleway',
  'Work Sans',
  'DM Sans',
  'Source Sans 3',
  'Oswald',
  'Playfair Display',
  'Merriweather',
  'Libre Baskerville',
  'Space Grotesk',
  'IBM Plex Sans',
  'Fira Sans',
  'Rubik',
  'Manrope',
]

const HEX_RE = /^#[0-9a-f]{6}$/i

export function normalizeHexColor(value, fallback) {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (HEX_RE.test(trimmed)) return trimmed.toLowerCase()
  const short = trimmed.replace('#', '')
  if (/^[0-9a-f]{3}$/i.test(short)) {
    const expanded = short.split('').map((c) => c + c).join('')
    return `#${expanded}`.toLowerCase()
  }
  return fallback
}

export function normalizeBrandColors(input) {
  const base = { ...DEFAULT_BRAND_COLORS }
  if (!input || typeof input !== 'object') return base
  for (const { key } of BRAND_COLOR_FIELDS) {
    base[key] = normalizeHexColor(input[key], DEFAULT_BRAND_COLORS[key])
  }
  return base
}

export function normalizeBrandFonts(input) {
  const raw = input && typeof input === 'object' ? { ...input } : {}
  if (raw.heading && !raw.headline) raw.headline = raw.heading
  delete raw.heading
  const pick = (key) => (GOOGLE_FONT_OPTIONS.includes(raw[key]) ? raw[key] : DEFAULT_BRAND_FONTS[key])
  return {
    headline: pick('headline'),
    body: pick('body'),
    accent: pick('accent'),
  }
}

export function googleFontStylesheetHref(families) {
  const unique = [...new Set(families.filter(Boolean))]
  if (!unique.length) return null
  const query = unique
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;600;700`)
    .join('&')
  return `https://fonts.googleapis.com/css2?${query}&display=swap`
}

/** Inject a Google Fonts stylesheet (shared by branding preview and canvas text). */
export function injectGoogleFontsLink(families) {
  const href = googleFontStylesheetHref(families)
  if (!href) return
  const id = 'sketchgen-google-fonts'
  let link = document.getElementById(id)
  if (!link) {
    link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    document.head.appendChild(link)
  }
  if (link.href !== href) link.href = href
}

const loadedFontFamilies = new Set()

/** Load a Google Font for canvas fillText (no-op if already loaded). */
export async function ensureGoogleFontLoaded(family) {
  if (!family || typeof document === 'undefined') return
  injectGoogleFontsLink([family])
  if (loadedFontFamilies.has(family)) return
  try {
    await document.fonts.load(`400 16px "${family}"`)
    await document.fonts.load(`700 16px "${family}"`)
    loadedFontFamilies.add(family)
  } catch {
    loadedFontFamilies.add(family)
  }
}

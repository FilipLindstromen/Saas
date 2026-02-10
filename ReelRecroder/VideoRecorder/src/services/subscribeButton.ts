/**
 * Premade YouTube-style subscribe button as SVG data URL.
 * Use for static "Subscribe" overlay (no external API).
 */
const WIDTH = 200
const HEIGHT = 50

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#e53935"/>
      <stop offset="100%" style="stop-color:#c62828"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" rx="4" ry="4" fill="url(#bg)"/>
  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" rx="4" ry="4" fill="none" stroke="rgba(0,0,0,0.2)" stroke-width="1"/>
  <text x="${WIDTH / 2}" y="${HEIGHT / 2 + 6}" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="white" text-anchor="middle">SUBSCRIBE</text>
</svg>`

const DATA_URL = `data:image/svg+xml,${encodeURIComponent(SVG)}`

export const SUBSCRIBE_BUTTON_DATA_URL = DATA_URL
export const SUBSCRIBE_BUTTON_WIDTH = WIDTH
export const SUBSCRIBE_BUTTON_HEIGHT = HEIGHT

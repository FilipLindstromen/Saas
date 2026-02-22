/** Color for each element type - used in toolbar, layers, timeline */
export const ELEMENT_TYPE_COLORS = {
  image: '#0ea5e9',      /* sky */
  'image-text': '#3b82f6', /* blue */
  headline: '#22c55e',   /* green */
  arrow: '#f97316',     /* orange */
  cta: '#8b5cf6',       /* violet */
  gradient: '#ec4899'   /* pink */
}

export function getElementTypeColor(type) {
  return ELEMENT_TYPE_COLORS[type] ?? '#6b7280'
}

export const ELEMENT_TYPES = [
  { type: 'image', label: 'Image', title: 'Image only', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  )},
  { type: 'image-text', label: 'Image+Text', title: 'Image + Text', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="10" height="10" rx="2" />
      <circle cx="6" cy="6" r="1" />
      <path d="M3 13l4-3 3 2 3-4 4 3" />
      <path d="M15 4h6M15 8h4M15 12h5" />
    </svg>
  )},
  { type: 'headline', label: 'Headline', title: 'Headline', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h12M4 18h8" />
    </svg>
  )},
  { type: 'arrow', label: 'Arrow', title: 'Arrow', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )},
  { type: 'cta', label: 'CTA', title: 'CTA Button', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="8" width="18" height="8" rx="2" />
    </svg>
  )},
  { type: 'gradient', label: 'Gradient', title: 'Gradient overlay', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <defs>
        <linearGradient id="gradient-icon" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="18" height="18" rx="2" fill="url(#gradient-icon)" stroke="currentColor" strokeWidth="2" />
    </svg>
  )}
]

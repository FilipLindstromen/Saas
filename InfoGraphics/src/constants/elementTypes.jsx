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
  )}
]

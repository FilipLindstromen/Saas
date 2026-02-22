export default function ElementTypeIcon({ type, id, size = 16 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (type) {
    case 'headline':
      return (
        <svg {...common}>
          <path d="M4 6h16M4 12h12M4 18h8" />
        </svg>
      )
    case 'cta':
      return (
        <svg {...common}>
          <rect x="3" y="8" width="18" height="8" rx="2" />
          <path d="M12 8v8" />
        </svg>
      )
    case 'arrow':
      return (
        <svg {...common}>
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      )
    case 'image':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      )
    case 'image-text':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 15h6M3 12h9" />
          <circle cx="8" cy="8" r="2" />
        </svg>
      )
    case 'gradient':
      const gradId = `element-grad-${id ?? Math.random().toString(36).slice(2)}`
      return (
        <svg {...common}>
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect x="3" y="3" width="18" height="18" rx="2" fill={`url(#${gradId})`} stroke="currentColor" strokeWidth="2" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      )
  }
}

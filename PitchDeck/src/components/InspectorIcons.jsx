const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export const INSPECTOR_GROUP_LABELS = {
  document: 'Document',
  slide: 'Slide',
  record: 'Record',
  object: 'Object',
}

export const INSPECTOR_TABS = [
  { id: 'layout', label: 'Layout', group: 'document' },
  { id: 'colors', label: 'Colors', group: 'document' },
  { id: 'typography', label: 'Typography', group: 'document' },
  { id: 'slide-lines', label: 'Line reveal', group: 'slide' },
  { id: 'slide-motion', label: 'Motion', group: 'slide' },
  { id: 'gradient', label: 'Gradient', group: 'slide' },
  { id: 'media', label: 'Media', group: 'slide' },
  { id: 'devices', label: 'Camera & microphone', group: 'record' },
  { id: 'output', label: 'Recording output', group: 'record' },
  { id: 'video-adj', label: 'Video adjustments', group: 'record' },
  { id: 'captions', label: 'Captions', group: 'record' },
  { id: 'object', label: 'Object', group: 'object' },
]

const LEGACY_TAB_IDS = {
  document: 'layout',
  slide: 'gradient',
  'slide-bg': 'colors',
  present: 'slide-motion',
  playback: 'slide-motion',
  transitions: 'slide-motion',
  'text-anim': 'slide-motion',
  'bg-anim': 'slide-motion',
  'active-object': 'object',
}

export function getInspectorTabMeta(tabId) {
  const id = normalizeInspectorTab(tabId)
  return INSPECTOR_TABS.find((t) => t.id === id) || INSPECTOR_TABS[0]
}

export function normalizeInspectorTab(tab) {
  if (!tab) return 'layout'
  return LEGACY_TAB_IDS[tab] || tab
}

export function InspectorTabIcon({ tabId }) {
  switch (tabId) {
    case 'layout':
      return (
        <svg {...iconProps}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
      )
    case 'colors':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3a9 9 0 0 1 0 18" fill="currentColor" stroke="none" opacity="0.35" />
        </svg>
      )
    case 'typography':
      return (
        <svg {...iconProps}>
          <path d="M4 7V5h16v2" />
          <path d="M12 5v14" />
          <path d="M8 19h8" />
        </svg>
      )
    case 'slide-lines':
      return (
        <svg {...iconProps}>
          <path d="M4 7h16" />
          <path d="M4 12h12" />
          <path d="M4 17h8" />
        </svg>
      )
    case 'slide-motion':
      return (
        <svg {...iconProps}>
          <path d="M5 12h3l2 7 4-14 2 7h3" />
        </svg>
      )
    case 'slide':
      return (
        <svg {...iconProps}>
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      )
    case 'gradient':
      return (
        <svg {...iconProps}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 15l6-6 4 4 8-8" />
        </svg>
      )
    case 'media':
      return (
        <svg {...iconProps}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="10.5" r="1.5" fill="currentColor" stroke="none" />
          <path d="M21 16l-5.5-5.5L5 19" />
        </svg>
      )
    case 'transitions':
      return (
        <svg {...iconProps}>
          <rect x="3" y="8" width="8" height="8" rx="1" />
          <rect x="13" y="8" width="8" height="8" rx="1" />
          <path d="M11 12h2" />
        </svg>
      )
    case 'text-anim':
      return (
        <svg {...iconProps}>
          <path d="M4 7h16" />
          <path d="M4 12h10" />
          <path d="M4 17h14" />
        </svg>
      )
    case 'bg-anim':
      return (
        <svg {...iconProps}>
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      )
    case 'devices':
      return (
        <svg {...iconProps}>
          <path d="M23 7l-7 5 7 5V7z" />
          <rect x="1" y="5" width="15" height="14" rx="2" />
        </svg>
      )
    case 'output':
      return (
        <svg {...iconProps}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )
    case 'video-adj':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      )
    case 'captions':
      return (
        <svg {...iconProps}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M7 15h4M13 15h4M7 11h10" />
        </svg>
      )
    case 'object':
      return (
        <svg {...iconProps}>
          <path d="M12 2l8 4.5v11L12 22l-8-4.5v-11L12 2z" />
          <path d="M12 22V12M20 6.5L12 12 4 6.5" />
        </svg>
      )
    default:
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      )
  }
}

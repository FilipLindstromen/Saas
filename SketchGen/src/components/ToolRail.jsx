import './ToolRail.css'

export const TOOLS = [
  {
    id: 'move',
    label: 'Move & transform — drag layers or floating selections; Ctrl+T free transform',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v18M3 12h18" />
        <path d="M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4" />
      </svg>
    ),
  },
  {
    id: 'lasso',
    label: 'Lasso — draw a selection (Shift for rectangle); fill or transform after',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4l4 16 3-7 7-3z" strokeDasharray="3 2" />
      </svg>
    ),
  },
  {
    id: 'lasso-fill',
    label: 'Lasso fill — draw a closed shape and fill with the current color',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6l5 14 2-6 6-2z" strokeDasharray="3 2" />
        <path d="M19 14c0 2-1.5 3.5-1.5 3.5S16 16 16 14a1.5 1.5 0 0 1 3 0z" />
      </svg>
    ),
  },
  {
    id: 'pen',
    label: 'Pen',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19l7-7 3 3-7 7-3-3z" />
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        <path d="M2 2l7.586 7.586" />
        <circle cx="11" cy="11" r="2" />
      </svg>
    ),
  },
  {
    id: 'eraser',
    label: 'Eraser',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 20H7L3.5 16.5a1.5 1.5 0 0 1 0-2.121l9.879-9.879a1.5 1.5 0 0 1 2.121 0l5.5 5.5a1.5 1.5 0 0 1 0 2.121L13 20" />
        <path d="M7 20l-3.5-3.5" />
      </svg>
    ),
  },
  {
    id: 'text',
    label: 'Text',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7V4h16v3" />
        <path d="M9 20h6" />
        <path d="M12 4v16" />
      </svg>
    ),
  },
  {
    id: 'fill',
    label: 'Fill',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 2l9 9-9 9-9-9 2-2" />
        <path d="M2 11l8-8" />
        <path d="M19 14c0 2-1.5 3.5-1.5 3.5S16 16 16 14a1.5 1.5 0 0 1 3 0z" />
      </svg>
    ),
  },
  {
    id: 'eyedropper',
    label: 'Color picker — click to sample color (copies hex to clipboard)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m2 22 1-1h3l9-9-3-3-9 9v3z" />
        <path d="M15 6l3 3" />
        <path d="m18 3 3 3-2 2-3-3 2-2z" />
      </svg>
    ),
  },
  {
    id: 'wand',
    label: 'Magic wand — click a color to select connected area (then fill or draw)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 4V2" />
        <path d="M15 8V6" />
        <path d="M15 12v-2" />
        <path d="M11 5h2" />
        <path d="M7 5h2" />
        <path d="M3 21l9-9" />
        <path d="M12.5 11.5L16 8" />
      </svg>
    ),
  },
  {
    id: 'blur',
    label: 'Blur',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8" strokeDasharray="2 3" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    id: 'defringe',
    label: 'Defringe — paint over halos (white or dark edges) to smooth anti-aliasing',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="5" width="14" height="14" rx="2" />
        <path d="M5 12h14" strokeDasharray="2 2" opacity="0.45" />
        <path d="M12 5v14" strokeDasharray="2 2" opacity="0.45" />
        <path d="M8 8l8 8M16 8l-8 8" strokeWidth="1.5" opacity="0.55" />
      </svg>
    ),
  },
  {
    id: 'line',
    label: 'Line (hold Shift to snap 45°)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20L20 4" />
      </svg>
    ),
  },
  {
    id: 'arrow',
    label: 'Arrow (hold Shift to snap 45°)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h12" />
        <path d="M13 6l6 6-6 6" />
      </svg>
    ),
  },
  {
    id: 'rect',
    label: 'Rectangle (hold Shift for square)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="6" width="16" height="12" rx="1" />
      </svg>
    ),
  },
  {
    id: 'circle',
    label: 'Circle (hold Shift for perfect circle)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8" />
      </svg>
    ),
  },
  {
    id: 'stamp',
    label: 'Stamp (icons & GIFs)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M8.5 13.5l2.5-3 2 2.5 2-2.5 3.5 4.5" />
        <circle cx="8" cy="8" r="1.5" />
      </svg>
    ),
  },
]

/** Vertical tool selector, Photoshop-style: a narrow icon rail down the left edge. */
export default function ToolRail({ tool, onToolChange }) {
  return (
    <div className="tool-rail">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`tool-rail-btn ${tool === t.id ? 'active' : ''}`}
          onClick={() => onToolChange(t.id)}
          title={t.label}
          aria-pressed={tool === t.id}
        >
          {t.icon}
        </button>
      ))}
    </div>
  )
}

import DocumentPanel from './DocumentPanel'
import LayoutsPanel from './LayoutsPanel'
import './LeftPanel.css'

const ELEMENT_TYPES = [
  { type: 'image', label: 'Image', title: 'Image only', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  )},
  { type: 'image-text', label: 'Image+Text', title: 'Image + Text', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
      <path d="M4 18h8" />
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

export default function LeftPanel({
  tab = 'elements',
  onTabChange,
  onAddElement,
  onApplyLayout,
  aspectRatio,
  onAspectRatioChange,
  resolution,
  onResolutionChange,
  backgroundColor,
  onBackgroundColorChange,
  includeBackgroundInExport,
  onIncludeBackgroundInExportChange,
  defaultFontFamily,
  onDefaultFontFamilyChange,
  defaultFontSize,
  onDefaultFontSizeChange
}) {
  return (
    <div className="left-panel">
      <div className="left-panel-tabs">
        <button
          type="button"
          className={`left-panel-tab ${tab === 'elements' ? 'active' : ''}`}
          onClick={() => onTabChange?.('elements')}
        >
          Elements
        </button>
        <button
          type="button"
          className={`left-panel-tab ${tab === 'document' ? 'active' : ''}`}
          onClick={() => onTabChange?.('document')}
        >
          Document
        </button>
        <button
          type="button"
          className={`left-panel-tab ${tab === 'layouts' ? 'active' : ''}`}
          onClick={() => onTabChange?.('layouts')}
        >
          Layouts
        </button>
      </div>
      <div className="left-panel-content">
        {tab === 'elements' && (
          <div className="elements-panel">
            <p className="elements-panel-hint">Click to add to canvas</p>
            <div className="elements-panel-grid">
              {ELEMENT_TYPES.map(({ type, title, icon }) => (
                <button
                  key={type}
                  type="button"
                  className="elements-panel-btn"
                  onClick={() => onAddElement(type)}
                  title={title}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        )}
        {tab === 'document' && (
          <DocumentPanel
            aspectRatio={aspectRatio}
            onAspectRatioChange={onAspectRatioChange}
            resolution={resolution}
            onResolutionChange={onResolutionChange}
            backgroundColor={backgroundColor}
            onBackgroundColorChange={onBackgroundColorChange}
            includeBackgroundInExport={includeBackgroundInExport}
            onIncludeBackgroundInExportChange={onIncludeBackgroundInExportChange}
            defaultFontFamily={defaultFontFamily}
            onDefaultFontFamilyChange={onDefaultFontFamilyChange}
            defaultFontSize={defaultFontSize}
            onDefaultFontSizeChange={onDefaultFontSizeChange}
          />
        )}
        {tab === 'layouts' && <LayoutsPanel onApplyLayout={onApplyLayout} />}
      </div>
    </div>
  )
}

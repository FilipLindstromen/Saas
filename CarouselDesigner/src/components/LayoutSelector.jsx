import { useEffect, useState } from 'react'
import './LayoutSelector.css'

const LAYOUTS_VISIBLE_KEY = 'carouselDesignerShowLayouts'

const LAYOUTS = [
  {
    id: 'default',
    name: 'Bottom caption',
    description: 'Classic IG carousel — text anchored at the bottom',
    thumbnail: (
      <div className="layout-thumbnail-content layout-thumbnail-carousel">
        <div className="layout-thumbnail-photo" />
        <div className="layout-thumbnail-text-bottom">Aa</div>
      </div>
    ),
  },
  {
    id: 'top',
    name: 'Top hook',
    description: 'Bold opener at the top — great for slide 1',
    thumbnail: (
      <div className="layout-thumbnail-content layout-thumbnail-carousel">
        <div className="layout-thumbnail-text-top">Aa</div>
        <div className="layout-thumbnail-photo layout-thumbnail-photo-fill" />
      </div>
    ),
  },
  {
    id: 'centered',
    name: 'Center statement',
    description: 'Single idea centered on the slide',
    thumbnail: (
      <div className="layout-thumbnail-content layout-thumbnail-carousel">
        <div className="layout-thumbnail-photo layout-thumbnail-photo-fill" />
        <div className="layout-thumbnail-text-center">Aa</div>
      </div>
    ),
  },
  {
    id: 'right',
    name: 'Right caption',
    description: 'Text bottom-right — asymmetric carousel look',
    thumbnail: (
      <div className="layout-thumbnail-content layout-thumbnail-carousel">
        <div className="layout-thumbnail-photo layout-thumbnail-photo-fill" />
        <div className="layout-thumbnail-text-bottom-right">Aa</div>
      </div>
    ),
  },
  {
    id: 'bulletpoints',
    name: 'Tips list',
    description: 'Numbered or bulleted tips (one per line)',
    thumbnail: (
      <div className="layout-thumbnail-content">
        <div className="layout-thumbnail-bullets" aria-hidden="true">
          <div className="layout-thumbnail-bullet-row">
            <span className="layout-thumbnail-bullet-dot" />
            <span className="layout-thumbnail-bullet-line" />
          </div>
          <div className="layout-thumbnail-bullet-row">
            <span className="layout-thumbnail-bullet-dot" />
            <span className="layout-thumbnail-bullet-line layout-thumbnail-bullet-line-short" />
          </div>
          <div className="layout-thumbnail-bullet-row">
            <span className="layout-thumbnail-bullet-dot" />
            <span className="layout-thumbnail-bullet-line" />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'minimal',
    name: 'Minimal type',
    description: 'Type-only slide — no photo required',
    thumbnail: (
      <div className="layout-thumbnail-content layout-thumbnail-carousel layout-thumbnail-minimal">
        <div className="layout-thumbnail-text-center layout-thumbnail-text-large">Aa</div>
      </div>
    ),
  },
]

const CAMERA_OVERRIDE_POSITIONS = [
  { id: 'disabled', title: 'Camera disabled', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="6" fill="currentColor" fillOpacity="0.3" /><line x1="4" y1="4" x2="20" y2="20" strokeWidth="2" /></svg> },
  { id: 'fullscreen', title: 'Full screen', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="1" width="22" height="22" rx="2" /><circle cx="12" cy="12" r="4" /></svg> },
  { id: 'left-third', title: 'Left 1/3', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="1" width="8" height="22" rx="1" /><rect x="10" y="1" width="13" height="22" rx="1" opacity="0.3" /><circle cx="4" cy="12" r="3" /></svg> },
  { id: 'right-third', title: 'Right 1/3', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="1" width="13" height="22" rx="1" opacity="0.3" /><rect x="15" y="1" width="8" height="22" rx="1" /><circle cx="20" cy="12" r="3" /></svg> },
  { id: 'circle-bottom-left', title: 'Circle bottom left', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="1" width="22" height="22" rx="2" opacity="0.3" /><circle cx="6" cy="18" r="4" /></svg> },
  { id: 'circle-bottom-right', title: 'Circle bottom right', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="1" width="22" height="22" rx="2" opacity="0.3" /><circle cx="18" cy="18" r="4" /></svg> },
  { id: 'circle-top-left', title: 'Circle top left', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="1" width="22" height="22" rx="2" opacity="0.3" /><circle cx="6" cy="6" r="4" /></svg> },
  { id: 'circle-top-right', title: 'Circle top right', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="1" width="22" height="22" rx="2" opacity="0.3" /><circle cx="18" cy="6" r="4" /></svg> },
]

function LayoutSelector({ onSelectLayout, selectedLayout = 'default', cameraOverrideEnabled = false, cameraOverridePosition = 'fullscreen', onCameraOverrideChange, onCameraOverridePositionSelect, selectedCount = 1 }) {
  const displayLayout = ['left-video', 'right-video', 'video'].includes(selectedLayout) ? 'default' : selectedLayout
  const [layoutsVisible, setLayoutsVisible] = useState(() => {
    try {
      return localStorage.getItem(LAYOUTS_VISIBLE_KEY) !== 'false'
    } catch {
      return true
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(LAYOUTS_VISIBLE_KEY, layoutsVisible ? 'true' : 'false')
    } catch {
      /* ignore */
    }
  }, [layoutsVisible])

  return (
    <div className={`layout-selector ${layoutsVisible ? '' : 'layout-selector-collapsed'}`}>
      <div className="layout-selector-header">
        <span className="layout-selector-title">Layouts</span>
        <div className="layout-selector-header-actions">
          {layoutsVisible && selectedCount > 1 && (
            <span className="layout-selector-multi-hint">Applying to {selectedCount} slides</span>
          )}
          <button
            type="button"
            className="layout-selector-toggle"
            onClick={() => setLayoutsVisible((v) => !v)}
            aria-expanded={layoutsVisible}
            title={layoutsVisible ? 'Hide layouts' : 'Show layouts'}
          >
            {layoutsVisible ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      {layoutsVisible ? (
        <>
      <div className="layout-thumbnails">
        {LAYOUTS.map((layout) => (
          <div
            key={layout.id}
            className={`layout-thumbnail ${displayLayout === layout.id ? 'selected' : ''}`}
            onClick={() => onSelectLayout(layout.id)}
            title={layout.description}
          >
            <div className="layout-thumbnail-preview">
              {layout.thumbnail}
            </div>
            <div className="layout-thumbnail-name">{layout.name}</div>
          </div>
        ))}
      </div>
      <div className="camera-override-row">
        <div className="camera-override-toggles">
          <label className="camera-override-toggle">
            <input
              type="checkbox"
              checked={!!cameraOverrideEnabled}
              onChange={(e) => onCameraOverrideChange?.(e.target.checked)}
            />
            <span className="camera-override-label">Camera Override</span>
          </label>
        </div>
        {cameraOverrideEnabled && (
          <div className="camera-override-icons">
            {CAMERA_OVERRIDE_POSITIONS.map((pos) => (
              <button
                key={pos.id}
                type="button"
                className={`camera-override-icon ${cameraOverridePosition === pos.id ? 'selected' : ''}`}
                onClick={() => onCameraOverridePositionSelect?.(pos.id)}
                title={pos.title}
              >
                {pos.icon}
              </button>
            ))}
          </div>
        )}
      </div>
        </>
      ) : null}
    </div>
  )
}

export default LayoutSelector

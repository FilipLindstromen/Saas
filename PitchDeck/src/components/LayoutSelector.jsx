import './LayoutSelector.css'

const LAYOUTS = [
  {
    id: 'default',
    name: 'Left Aligned',
    description: 'Text aligned to the left',
    thumbnail: (
      <div className="layout-thumbnail-content">
        <div className="layout-thumbnail-text-left">TEXT</div>
      </div>
    )
  },
  {
    id: 'left-video',
    name: 'Left with Video',
    description: 'Left aligned text with full-height video on right',
    thumbnail: (
      <div className="layout-thumbnail-content">
        <div className="layout-thumbnail-left-video">
          <div className="layout-thumbnail-text-left-small">TEXT</div>
          <div className="layout-thumbnail-video-panel"></div>
        </div>
      </div>
    )
  },
  {
    id: 'centered',
    name: 'Centered',
    description: 'Text centered on slide',
    thumbnail: (
      <div className="layout-thumbnail-content">
        <div className="layout-thumbnail-text-center">TEXT</div>
      </div>
    )
  },
  {
    id: 'right',
    name: 'Right Aligned',
    description: 'Text aligned to the right',
    thumbnail: (
      <div className="layout-thumbnail-content">
        <div className="layout-thumbnail-text-right">TEXT</div>
      </div>
    )
  },
  {
    id: 'bulletpoints',
    name: 'Bullet Points',
    description: 'Animated bullet points',
    thumbnail: (
      <div className="layout-thumbnail-content">
        <div className="layout-thumbnail-bullets">
          <div className="layout-thumbnail-bullet">• Point 1</div>
          <div className="layout-thumbnail-bullet">• Point 2</div>
          <div className="layout-thumbnail-bullet">• Point 3</div>
        </div>
      </div>
    )
  },
  {
    id: 'video',
    name: 'Video Fullscreen',
    description: 'Full screen video/webcam',
    thumbnail: (
      <div className="layout-thumbnail-content">
        <div className="layout-thumbnail-video">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 7l-7 5 7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        </div>
      </div>
    )
  }
]

const CAMERA_OVERRIDE_POSITIONS = [
  { id: 'disabled', title: 'Camera disabled', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="6" fill="currentColor" fillOpacity="0.3" /><line x1="4" y1="4" x2="20" y2="20" strokeWidth="2" /></svg> },
  { id: 'fullscreen', title: 'Full screen', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="1" width="22" height="22" rx="2" /><circle cx="12" cy="12" r="4" /></svg> },
  { id: 'left-third', title: 'Left 1/3', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="1" width="8" height="22" rx="1" /><rect x="10" y="1" width="13" height="22" rx="1" opacity="0.3" /><circle cx="4" cy="12" r="3" /></svg> },
  { id: 'right-third', title: 'Right 1/3', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="1" width="13" height="22" rx="1" opacity="0.3" /><rect x="15" y="1" width="8" height="22" rx="1" /><circle cx="20" cy="12" r="3" /></svg> },
  { id: 'circle-bottom-left', title: 'Circle bottom left', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="1" width="22" height="22" rx="2" opacity="0.3" /><circle cx="6" cy="18" r="4" /></svg> },
  { id: 'circle-bottom-right', title: 'Circle bottom right', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="1" width="22" height="22" rx="2" opacity="0.3" /><circle cx="18" cy="18" r="4" /></svg> },
  { id: 'circle-top-left', title: 'Circle top left', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="1" width="22" height="22" rx="2" opacity="0.3" /><circle cx="6" cy="6" r="4" /></svg> },
  { id: 'circle-top-right', title: 'Circle top right', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="1" width="22" height="22" rx="2" opacity="0.3" /><circle cx="18" cy="6" r="4" /></svg> }
]

function LayoutSelector({ onSelectLayout, selectedLayout = 'default', cameraOverrideEnabled = false, cameraOverridePosition = 'fullscreen', onCameraOverrideChange, onCameraOverridePositionSelect }) {
  return (
    <div className="layout-selector">
      <div className="layout-selector-header">
        <span className="layout-selector-title">Layouts</span>
      </div>
      <div className="layout-thumbnails">
        {LAYOUTS.map((layout) => (
          <div
            key={layout.id}
            className={`layout-thumbnail ${selectedLayout === layout.id ? 'selected' : ''}`}
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
        <label className="camera-override-toggle">
          <input
            type="checkbox"
            checked={!!cameraOverrideEnabled}
            onChange={(e) => onCameraOverrideChange?.(e.target.checked)}
          />
          <span className="camera-override-label">Camera Override</span>
        </label>
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
    </div>
  )
}

export default LayoutSelector

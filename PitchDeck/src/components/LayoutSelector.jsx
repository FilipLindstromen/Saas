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
    name: 'Video Only',
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

function LayoutSelector({ onSelectLayout, selectedLayout = 'default' }) {
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
    </div>
  )
}

export default LayoutSelector

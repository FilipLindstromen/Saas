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
  }
]

function LayoutSelector({ onSelectLayout }) {
  return (
    <div className="layout-selector">
      <div className="layout-selector-header">
        <span className="layout-selector-title">Layouts</span>
      </div>
      <div className="layout-thumbnails">
        {LAYOUTS.map((layout) => (
          <div
            key={layout.id}
            className="layout-thumbnail"
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

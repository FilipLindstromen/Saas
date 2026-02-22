import InspectorPanel from './InspectorPanel'
import AnimationPanel from './AnimationPanel'
import ImageSearch from './ImageSearch'
import './RightPanel.css'

const IconInspector = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
)
const IconAnimation = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3" />
    <line x1="19" y1="12" x2="5" y2="12" />
  </svg>
)

export default function RightPanel({
  element,
  selectedIds = [],
  tab = 'inspector',
  onTabChange,
  onUpdate,
  onDelete,
  apiKeys,
  latestImages,
  onImageSelect,
  showImageSearch,
  onCloseImageSearch,
  width = 320,
  onResize
}) {
  const activeTab = tab || 'inspector'

  return (
    <div className="right-panel" style={{ width }}>
      {onResize && (
        <div
          className="right-panel-resize-handle"
          onPointerDown={(e) => {
            e.preventDefault()
            const startX = e.clientX
            const startW = width
            const move = (ev) => {
              const dx = startX - ev.clientX
              const newW = Math.max(200, Math.min(500, startW + dx))
              onResize(newW)
            }
            const up = () => {
              document.removeEventListener('pointermove', move)
              document.removeEventListener('pointerup', up)
              document.body.style.cursor = ''
              document.body.style.userSelect = ''
            }
            document.body.style.cursor = 'col-resize'
            document.body.style.userSelect = 'none'
            document.addEventListener('pointermove', move)
            document.addEventListener('pointerup', up)
          }}
          title="Drag to resize"
        />
      )}
      <div className="right-panel-tabs">
        <button
          type="button"
          className={`right-panel-tab ${activeTab === 'inspector' ? 'active' : ''}`}
          onClick={() => onTabChange?.('inspector')}
          title="Inspector"
        >
          <IconInspector />
        </button>
        <button
          type="button"
          className={`right-panel-tab ${activeTab === 'animation' ? 'active' : ''}`}
          onClick={() => onTabChange?.('animation')}
          title="Animation"
        >
          <IconAnimation />
        </button>
      </div>
      <div className="right-panel-content">
        {showImageSearch ? (
          <ImageSearch
            latestImages={latestImages}
            onSelect={onImageSelect}
            onClose={onCloseImageSearch}
            apiKeys={apiKeys}
          />
        ) : activeTab === 'inspector' ? (
          <InspectorPanel
            element={element}
            selectedCount={selectedIds.length}
            onUpdate={onUpdate}
            onDelete={onDelete}
            apiKeys={apiKeys}
            latestImages={latestImages}
            onImageSelect={onImageSelect}
          />
        ) : activeTab === 'animation' ? (
          <AnimationPanel
            element={element}
            selectedCount={selectedIds.length}
            onUpdate={onUpdate}
          />
        ) : null}
      </div>
    </div>
  )
}

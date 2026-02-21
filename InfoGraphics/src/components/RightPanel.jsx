import InspectorPanel from './InspectorPanel'
import LayersPanel from './LayersPanel'
import ImageSearch from './ImageSearch'
import './RightPanel.css'

export default function RightPanel({
  element,
  elements = [],
  selectedIds = [],
  tab = 'inspector',
  onTabChange,
  onUpdate,
  onDelete,
  onSelect,
  onReorder,
  onReorderToIndex,
  onToggleVisibility,
  onRename,
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
        >
          Inspector
        </button>
        <button
          type="button"
          className={`right-panel-tab ${activeTab === 'layers' ? 'active' : ''}`}
          onClick={() => onTabChange?.('layers')}
        >
          Layers
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
        ) : activeTab === 'layers' ? (
          <LayersPanel
            elements={elements}
            selectedIds={selectedIds}
            onSelect={onSelect}
            onReorder={onReorder}
            onReorderToIndex={onReorderToIndex}
            onToggleVisibility={onToggleVisibility}
            onRename={onRename}
          />
        ) : null}
      </div>
    </div>
  )
}

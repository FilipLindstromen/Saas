import DocumentPanel from './DocumentPanel'
import LayoutsPanel from './LayoutsPanel'
import BrandKitPanel from './BrandKitPanel'
import LayersPanel from './LayersPanel'
import './LeftPanel.css'

const IconDocument = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
)
const IconLayouts = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
)
const IconBrand = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13.5" cy="6.5" r="4" />
    <path d="M4 20c0-4 4-6 8-6" />
    <path d="M12 12l2 2 4-4" />
  </svg>
)
const IconLayers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
  </svg>
)

export default function LeftPanel({
  tab = 'document',
  onTabChange,
  onApplyLayout,
  onApplyLayoutEmpty,
  selectedLayoutId,
  onSelectLayout,
  customTemplates,
  onCustomTemplatesChange,
  onEnterTemplateMode,
  templateEditMode = false,
  width = 240,
  onResize,
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
  onDefaultFontSizeChange,
  brandPrimaryColor,
  brandSecondaryColor,
  brandFontFamily,
  onBrandPrimaryColorChange,
  onBrandSecondaryColorChange,
  onBrandFontFamilyChange,
  onApplyBrandToSelection,
  onApplyBrandToAll,
  hasSelection = false,
  hasElements = false,
  elements = [],
  selectedIds = [],
  onSelect,
  onReorder,
  onReorderToIndex,
  onToggleVisibility,
  onRename
}) {
  return (
    <div className="left-panel" style={{ width }}>
      {onResize && (
        <div
          className="left-panel-resize-handle"
          onPointerDown={(e) => {
            e.preventDefault()
            const startX = e.clientX
            const startW = width
            const move = (ev) => {
              const dx = ev.clientX - startX
              const newW = Math.max(180, Math.min(400, startW + dx))
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
      <div className="left-panel-tabs">
        <button
          type="button"
          className={`left-panel-tab ${tab === 'document' ? 'active' : ''}`}
          onClick={() => onTabChange?.('document')}
          title="Document"
        >
          <IconDocument />
        </button>
        <button
          type="button"
          className={`left-panel-tab ${tab === 'layouts' ? 'active' : ''}`}
          onClick={() => onTabChange?.('layouts')}
          title="Layouts"
        >
          <IconLayouts />
        </button>
        <button
          type="button"
          className={`left-panel-tab ${tab === 'brand' ? 'active' : ''}`}
          onClick={() => onTabChange?.('brand')}
          title="Brand"
        >
          <IconBrand />
        </button>
        <button
          type="button"
          className={`left-panel-tab ${tab === 'layers' ? 'active' : ''}`}
          onClick={() => onTabChange?.('layers')}
          title="Layers"
        >
          <IconLayers />
        </button>
      </div>
      <div className="left-panel-content">
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
        {tab === 'layouts' && (
          <LayoutsPanel
            selectedLayoutId={selectedLayoutId}
            onSelectLayout={onSelectLayout}
            onApplyLayout={onApplyLayout}
            onApplyLayoutEmpty={onApplyLayoutEmpty}
            customTemplates={customTemplates}
            onCustomTemplatesChange={onCustomTemplatesChange}
            onEnterTemplateMode={onEnterTemplateMode}
            templateEditMode={templateEditMode}
          />
        )}
        {tab === 'brand' && (
          <BrandKitPanel
            primaryColor={brandPrimaryColor}
            secondaryColor={brandSecondaryColor}
            fontFamily={brandFontFamily}
            onPrimaryColorChange={onBrandPrimaryColorChange}
            onSecondaryColorChange={onBrandSecondaryColorChange}
            onFontFamilyChange={onBrandFontFamilyChange}
            onApplyToSelection={onApplyBrandToSelection}
            onApplyToAll={onApplyBrandToAll}
            hasSelection={hasSelection}
            hasElements={hasElements}
          />
        )}
        {tab === 'layers' && (
          <LayersPanel
            elements={elements}
            selectedIds={selectedIds}
            onSelect={onSelect}
            onReorder={onReorder}
            onReorderToIndex={onReorderToIndex}
            onToggleVisibility={onToggleVisibility}
            onRename={onRename}
          />
        )}
      </div>
    </div>
  )
}

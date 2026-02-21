import DocumentPanel from './DocumentPanel'
import LayoutsPanel from './LayoutsPanel'
import BrandKitPanel from './BrandKitPanel'
import './LeftPanel.css'

export default function LeftPanel({
  tab = 'document',
  onTabChange,
  onApplyLayout,
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
  hasElements = false
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
        <button
          type="button"
          className={`left-panel-tab ${tab === 'brand' ? 'active' : ''}`}
          onClick={() => onTabChange?.('brand')}
        >
          Brand
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
        {tab === 'layouts' && <LayoutsPanel onApplyLayout={onApplyLayout} />}
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
      </div>
    </div>
  )
}

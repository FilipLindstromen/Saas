import RecordingOptions from './RecordingOptions'
import CaptionsOptions from './CaptionsOptions'
import ColorOptions from './ColorOptions'
import TypographyOptions from './TypographyOptions'
import TransitionOptions from './TransitionOptions'
import SlideSettings from './SlideSettings'
import DocumentSettings from './DocumentSettings'
import ActiveObjectOptions from './ActiveObjectOptions'
import { INSPECTOR_TABS, INSPECTOR_GROUP_LABELS, InspectorTabIcon, getInspectorTabMeta, normalizeInspectorTab } from './InspectorIcons'
import { DrawingSettingsPanel } from './DrawingLayer'
import './InspectorPanel.css'

function InspectorPanel({
  activeTab,
  onTabChange,
  recordSettings,
  onUpdateRecordSettings,
  settings,
  onUpdateSettings,
  slides,
  onUpdateSlide,
  selectedSlide,
  selectedSlideId,
  selectedSlides = new Set(),
  selectedGraphicId,
  onDeselectGraphic,
  backgroundColor,
  drawingControls = null,
}) {
  const tab = normalizeInspectorTab(activeTab)
  const tabMeta = getInspectorTabMeta(tab)
  const groupLabel = INSPECTOR_GROUP_LABELS[tabMeta.group]

  const getIdsToUpdate = () => {
    if (selectedSlides.size > 0) return Array.from(selectedSlides)
    if (selectedSlideId != null) return [selectedSlideId]
    return []
  }

  const handleSlideUpdate = (updates) => {
    const ids = getIdsToUpdate()
    if (ids.length > 0 && onUpdateSlide) ids.forEach((id) => onUpdateSlide(id, updates))
  }

  const displaySlide = selectedSlides.size > 0
    ? (selectedSlideId && selectedSlides.has(selectedSlideId) ? selectedSlide : slides.find((s) => selectedSlides.has(s.id)))
    : selectedSlide

  const overlays = displaySlide?.graphicOverlays || []
  const selectedGraphic = selectedGraphicId && overlays.find((g) => g.id === selectedGraphicId)
  const objectCount = overlays.length

  const handleUpdateGraphic = (updates) => {
    if (!selectedSlideId || !selectedGraphicId || !onUpdateSlide) return
    const nextOverlays = [...(displaySlide?.graphicOverlays || [])]
    const idx = nextOverlays.findIndex((g) => g.id === selectedGraphicId)
    if (idx >= 0) {
      nextOverlays[idx] = { ...nextOverlays[idx], ...updates }
      onUpdateSlide(selectedSlideId, { graphicOverlays: nextOverlays })
    }
  }

  const handleDeleteGraphic = () => {
    if (!selectedSlideId || !selectedGraphicId || !onUpdateSlide || !onDeselectGraphic) return
    const nextOverlays = (displaySlide?.graphicOverlays || []).filter((g) => g.id !== selectedGraphicId)
    onUpdateSlide(selectedSlideId, { graphicOverlays: nextOverlays })
    onDeselectGraphic()
  }

  const slideSettingsProps = {
    slide: displaySlide,
    onUpdate: handleSlideUpdate,
    selectedCount: getIdsToUpdate().length,
    backgroundColor,
  }

  let prevGroup = null

  return (
    <div className="inspector-panel">
      <nav className="inspector-panel-nav" aria-label="Inspector sections">
        {INSPECTOR_TABS.map((item) => {
          const showDivider = prevGroup && item.group !== prevGroup
          prevGroup = item.group
          return (
            <div key={item.id} className="inspector-panel-nav-slot">
              {showDivider && <div className="inspector-panel-nav-divider" aria-hidden="true" />}
              <button
                type="button"
                className={`inspector-panel-nav-item ${tab === item.id ? 'active' : ''}`}
                onClick={() => onTabChange(item.id)}
                aria-current={tab === item.id ? 'page' : undefined}
                aria-label={item.label}
                title={item.label}
              >
                <InspectorTabIcon tabId={item.id} />
                {item.id === 'object' && objectCount > 0 && (
                  <span className="inspector-panel-badge">{objectCount}</span>
                )}
              </button>
            </div>
          )
        })}
      </nav>

      <div className="inspector-panel-content">
        {drawingControls ? (
          <div className="inspector-drawing-panel">
            <header className="inspector-panel-content-header">
              <p className="inspector-panel-content-group">Slide</p>
              <h2 className="inspector-panel-content-title">Drawing</h2>
            </header>
            <DrawingSettingsPanel layout="sidebar" {...drawingControls} />
          </div>
        ) : (
          <>
        <header className="inspector-panel-content-header">
          <p className="inspector-panel-content-group">{groupLabel}</p>
          <h2 className="inspector-panel-content-title">{tabMeta.label}</h2>
        </header>

        {tab === 'layout' && (
          <DocumentSettings
            slideFormat={settings.slideFormat || '16:9'}
            contentEdgeOffset={settings.contentEdgeOffset ?? 9}
            contentBottomOffset={settings.contentBottomOffset ?? 12}
            contentVerticalAlign={settings.contentVerticalAlign ?? 'bottom'}
            textAnimationMode={settings.textAnimationMode || 'manual'}
            editMotionPreview={settings.editMotionPreview !== false}
            onUpdateSettings={onUpdateSettings}
          />
        )}

        {tab === 'colors' && (
          <ColorOptions
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            slide={displaySlide}
            onUpdateSlide={handleSlideUpdate}
            selectedCount={getIdsToUpdate().length}
            backgroundColor={backgroundColor}
            embedded
          />
        )}

        {tab === 'typography' && (
          <TypographyOptions
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            slides={slides}
            onUpdateSlide={onUpdateSlide}
            selectedSlideId={selectedSlideId}
            selectedSlide={selectedSlide}
            openaiKey={settings.openaiKey}
            embedded
          />
        )}

        {tab === 'slide-background' && (
          <SlideSettings
            {...slideSettingsProps}
            section="background"
          />
        )}

        {tab === 'slide-motion' && (
          <>
            <SlideSettings {...slideSettingsProps} section="motion" />
            <TransitionOptions
              settings={settings}
              onUpdateSettings={onUpdateSettings}
              slide={displaySlide}
              onUpdateSlide={handleSlideUpdate}
              selectedCount={getIdsToUpdate().length}
              embedded
            />
          </>
        )}

        {tab === 'devices' && (
          <RecordingOptions
            recordSettings={recordSettings}
            onUpdateSettings={onUpdateRecordSettings}
            embedded
            section="devices"
          />
        )}

        {tab === 'output' && (
          <RecordingOptions
            recordSettings={recordSettings}
            onUpdateSettings={onUpdateRecordSettings}
            embedded
            section="output"
          />
        )}

        {tab === 'video-adj' && (
          <RecordingOptions
            recordSettings={recordSettings}
            onUpdateSettings={onUpdateRecordSettings}
            embedded
            section="videoAdj"
          />
        )}

        {tab === 'captions' && (
          <CaptionsOptions
            recordSettings={recordSettings}
            onUpdateSettings={onUpdateRecordSettings}
            embedded
          />
        )}

        {tab === 'object' && (
          selectedGraphic ? (
            <ActiveObjectOptions
              graphic={selectedGraphic}
              overlays={overlays}
              onUpdate={handleUpdateGraphic}
              onDeselect={onDeselectGraphic}
              onDelete={handleDeleteGraphic}
            />
          ) : (
            <div className="inspector-panel-empty">
              <p>Select a graphic on the slide to edit it here, or add one from the preview toolbar.</p>
            </div>
          )
        )}
          </>
        )}
      </div>
    </div>
  )
}

export default InspectorPanel

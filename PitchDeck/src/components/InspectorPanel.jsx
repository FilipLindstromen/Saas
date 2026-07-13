import RecordingOptions from './RecordingOptions'

import CaptionsOptions from './CaptionsOptions'

import ColorOptions from './ColorOptions'

import TypographyOptions from './TypographyOptions'

import TransitionOptions from './TransitionOptions'

import SlideSettings from './SlideSettings'

import DocumentSettings from './DocumentSettings'

import ActiveObjectOptions from './ActiveObjectOptions'

import './InspectorPanel.css'



const TABS = [

  { id: 'document', label: 'Document' },

  { id: 'slide', label: 'Slide' },

  { id: 'present', label: 'Present' },

  { id: 'object', label: 'Object' },

]



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

}) {

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



  return (

    <div className="inspector-panel">

      <nav className="inspector-panel-nav" aria-label="Inspector sections">

        {TABS.map((tab) => (

          <button

            key={tab.id}

            type="button"

            className={`inspector-panel-nav-item ${activeTab === tab.id ? 'active' : ''}`}

            onClick={() => onTabChange(tab.id)}

            aria-current={activeTab === tab.id ? 'page' : undefined}

          >

            <span>{tab.label}</span>

            {tab.id === 'object' && objectCount > 0 && (

              <span className="inspector-panel-badge">{objectCount}</span>

            )}

          </button>

        ))}

      </nav>

      <div className="inspector-panel-content">

        {activeTab === 'document' && (

          <>

            <DocumentSettings

              slideFormat={settings.slideFormat || '16:9'}

              contentEdgeOffset={settings.contentEdgeOffset ?? 9}

              contentBottomOffset={settings.contentBottomOffset ?? 12}

              contentVerticalAlign={settings.contentVerticalAlign ?? 'bottom'}

              onUpdateSettings={onUpdateSettings}

            />

            <ColorOptions

              settings={settings}

              onUpdateSettings={onUpdateSettings}

              embedded

            />

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

          </>

        )}

        {activeTab === 'slide' && (

          <SlideSettings

            slide={displaySlide}

            onUpdate={handleSlideUpdate}

            selectedCount={getIdsToUpdate().length}

            backgroundColor={backgroundColor}

          />

        )}

        {activeTab === 'present' && (

          <>

            <TransitionOptions

              settings={settings}

              onUpdateSettings={onUpdateSettings}

              embedded

            />

            <RecordingOptions

              recordSettings={recordSettings}

              onUpdateSettings={onUpdateRecordSettings}

              embedded

            />

            <CaptionsOptions

              recordSettings={recordSettings}

              onUpdateSettings={onUpdateRecordSettings}

              embedded

            />

          </>

        )}

        {activeTab === 'object' && (

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

      </div>

    </div>

  )

}



export default InspectorPanel


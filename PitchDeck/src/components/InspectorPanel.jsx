import RecordingOptions from './RecordingOptions'
import CaptionsOptions from './CaptionsOptions'
import ColorOptions from './ColorOptions'
import TypographyOptions from './TypographyOptions'
import TextEffectsOptions from './TextEffectsOptions'
import TransitionOptions from './TransitionOptions'
import './InspectorPanel.css'

const TABS = [
  { id: 'recording', label: 'Recording options', icon: 'recording' },
  { id: 'captions', label: 'Captions', icon: 'captions' },
  { id: 'typography', label: 'Typography', icon: 'typography' },
  { id: 'text-effects', label: 'Text effects', icon: 'text-effects' },
  { id: 'color', label: 'Color', icon: 'color' },
  { id: 'transitions', label: 'Transitions', icon: 'transitions' }
]

function InspectorPanel({
  activeTab,
  onTabChange,
  recordSettings,
  onUpdateRecordSettings,
  settings,
  onUpdateSettings,
  slides,
  onUpdateSlide
}) {
  return (
    <div className="inspector-panel">
      <div className="inspector-panel-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`inspector-panel-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            title={tab.label}
          >
            {tab.icon === 'recording' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" fill="currentColor" />
              </svg>
            )}
            {tab.icon === 'captions' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 12h10M7 16h6M7 8h10" />
                <rect x="2" y="4" width="20" height="16" rx="2" />
              </svg>
            )}
            {tab.icon === 'typography' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="4 7 4 4 20 4 20 7" />
                <line x1="9" y1="20" x2="15" y2="20" />
                <line x1="12" y1="4" x2="12" y2="20" />
              </svg>
            )}
            {tab.icon === 'text-effects' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
              </svg>
            )}
            {tab.icon === 'color' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            )}
            {tab.icon === 'transitions' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            )}
          </button>
        ))}
      </div>
      <div className="inspector-panel-content">
        {activeTab === 'recording' && (
          <RecordingOptions
            recordSettings={recordSettings}
            onUpdateSettings={onUpdateRecordSettings}
            embedded
          />
        )}
        {activeTab === 'captions' && (
          <CaptionsOptions
            recordSettings={recordSettings}
            onUpdateSettings={onUpdateRecordSettings}
            embedded
          />
        )}
        {activeTab === 'color' && (
          <ColorOptions
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            embedded
          />
        )}
        {activeTab === 'typography' && (
          <TypographyOptions
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            slides={slides}
            onUpdateSlide={onUpdateSlide}
            openaiKey={settings.openaiKey}
            embedded
          />
        )}
        {activeTab === 'text-effects' && (
          <TextEffectsOptions
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            embedded
          />
        )}
        {activeTab === 'transitions' && (
          <TransitionOptions
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            embedded
          />
        )}
      </div>
    </div>
  )
}

export default InspectorPanel

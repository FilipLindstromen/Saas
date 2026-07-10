import './SidebarTabs.css'

export const SIDEBAR_TABS = [
  { id: 'format', label: 'Format' },
  { id: 'background', label: 'Background' },
  { id: 'fonts', label: 'Fonts' },
  { id: 'copy', label: 'Copy' },
]

export default function SidebarTabs({ activeTab, onTabChange }) {
  return (
    <div className="nag-sidebar-tabs" role="tablist" aria-label="Sidebar sections">
      {SIDEBAR_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`nag-sidebar-tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

import React from 'react'
import { Layers, BookmarkCheck, Wand2, Settings2 } from 'lucide-react'
import TopicPicker from './TopicPicker.jsx'

export default function TopBar({ view, setView, favCount, onOpenSettings, categories, selectedCats, onToggleCat }) {
  return (
    <div style={{ padding: '14px 16px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <TabButton active={view === 'feed'} onClick={() => setView('feed')} icon={<Layers size={14} />} label="Learn" />
          <TabButton active={view === 'favorites'} onClick={() => setView('favorites')} icon={<BookmarkCheck size={14} />} label={`Saved${favCount ? ` (${favCount})` : ''}`} />
          <TabButton active={view === 'transform'} onClick={() => setView('transform')} icon={<Wand2 size={14} />} label="Transform" />
        </div>
        <button onClick={onOpenSettings} style={iconBtnStyle} aria-label="Settings">
          <Settings2 size={17} color="#DADADA" />
        </button>
      </div>

      {view === 'feed' && (
        <div style={{ marginTop: 8 }}>
          <TopicPicker categories={categories} selectedCats={selectedCats} onToggleCat={onToggleCat} />
        </div>
      )}
    </div>
  )
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: active ? '#F4F4F5' : 'transparent',
        color: active ? '#0B0B0C' : '#8E8E93',
        border: 'none', borderRadius: 20, padding: '7px 10px',
        fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >
      {icon}{label}
    </button>
  )
}

const iconBtnStyle = { background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }

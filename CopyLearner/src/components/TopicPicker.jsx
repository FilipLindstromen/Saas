import React, { useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export default function TopicPicker({ categories, selectedCats, onToggleCat }) {
  const [open, setOpen] = useState(false)

  const label = selectedCats.length === categories.length
    ? 'All topics'
    : selectedCats.length === 1
      ? categories.find((c) => c.id === selectedCats[0])?.label || 'Topic'
      : `${selectedCats.length} topics`

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 16,
          padding: '6px 10px', color: '#DADADA', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}
      >
        {label} <ChevronDown size={13} />
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{
            position: 'absolute', top: '120%', left: 0, zIndex: 41, minWidth: 190,
            background: '#1B1B1E', border: '1px solid #262629', borderRadius: 12, padding: 6,
            boxShadow: '0 16px 36px rgba(0,0,0,0.55)',
          }}>
            {categories.map((c) => {
              const active = selectedCats.includes(c.id)
              return (
                <button
                  key={c.id}
                  onClick={() => onToggleCat(c.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                    padding: '8px 10px', borderRadius: 8, background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                    border: 'none', color: '#E4E4E7', fontSize: 13, cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.accent, flexShrink: 0 }} />
                    {c.label}
                  </span>
                  {active && <Check size={14} color={c.accent} />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

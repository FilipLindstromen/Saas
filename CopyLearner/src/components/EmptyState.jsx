import React from 'react'
import { BookmarkCheck, Upload } from 'lucide-react'

export default function EmptyState({ view, onOpenSettings, onGoFeed }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#7A7A80', gap: 12, padding: 24 }}>
      {view === 'favorites' ? (
        <>
          <BookmarkCheck size={28} color="#4E4E54" />
          <p style={{ fontSize: 14, maxWidth: 240 }}>Nothing saved yet. Star a lesson while learning and it'll show up here.</p>
          <button onClick={onGoFeed} style={{ background: '#F4F4F5', border: 'none', borderRadius: 20, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Back to Learn</button>
        </>
      ) : (
        <>
          <Upload size={28} color="#4E4E54" />
          <p style={{ fontSize: 14, maxWidth: 240 }}>No lessons to show. Choose a topic, or upload your own content to learn from.</p>
          <button onClick={onOpenSettings} style={{ background: '#F4F4F5', border: 'none', borderRadius: 20, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Open settings</button>
        </>
      )}
    </div>
  )
}

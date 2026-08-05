import React, { useRef, useState } from 'react'
import { X, Upload, FileText, Trash2, Copy, Check, Loader2, Cloud, CloudOff, RefreshCw } from 'lucide-react'

const iconBtnStyle = { background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }

export default function SettingsSheet({
  categories, selectedCats, onToggleCat, onClose,
  sources, onAddFile, onAddText, onDeleteSource,
  cloudEnabled, workspaceCode, onJoinWorkspace,
}) {
  const [tab, setTab] = useState('topics')
  const [pasteTitle, setPasteTitle] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const handleFiles = (files) => {
    Array.from(files || []).forEach((f) => onAddFile(f))
  }

  const submitPaste = () => {
    if (!pasteText.trim()) return
    onAddText(pasteTitle.trim() || 'Pasted note', pasteText.trim())
    setPasteTitle('')
    setPasteText('')
  }

  const copyCode = () => {
    navigator.clipboard?.writeText(workspaceCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', zIndex: 50 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxHeight: '86vh', overflowY: 'auto', background: '#151517', borderRadius: '20px 20px 0 0', padding: '18px 18px 26px', border: '1px solid #232327', borderBottom: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ color: '#F4F4F5', fontWeight: 700, fontSize: 16, fontFamily: "'Space Grotesk', sans-serif" }}>Settings</span>
          <button onClick={onClose} style={iconBtnStyle}><X size={16} color="#DADADA" /></button>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          <TabButton active={tab === 'topics'} onClick={() => setTab('topics')} label="Topics" />
          <TabButton active={tab === 'content'} onClick={() => setTab('content')} label="My Content" />
        </div>

        {tab === 'topics' && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {categories.map((c) => {
                const active = selectedCats.includes(c.id)
                return (
                  <button
                    key={c.id}
                    onClick={() => onToggleCat(c.id)}
                    style={{
                      padding: '9px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13.5, fontWeight: 600,
                      border: `1.5px solid ${active ? c.accent : '#3A3A3E'}`,
                      background: active ? c.accent : 'transparent',
                      color: active ? '#0B0B0C' : '#ADADB2',
                    }}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>
            <p style={{ color: '#7A7A80', fontSize: 12, marginTop: 14, lineHeight: 1.5 }}>
              Select several for a mixed feed — switching topics between lessons helps you tell techniques apart, instead of blurring together.
            </p>
          </>
        )}

        {tab === 'content' && (
          <div>
            <SyncStatus cloudEnabled={cloudEnabled} workspaceCode={workspaceCode} copied={copied} onCopy={copyCode} joinCode={joinCode} setJoinCode={setJoinCode} onJoin={() => { if (joinCode.trim()) { onJoinWorkspace(joinCode.trim()); setJoinCode('') } }} />

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                marginTop: 16, border: `1.5px dashed ${dragOver ? '#9B7FE0' : '#3A3A3E'}`, borderRadius: 14,
                padding: '20px 16px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'rgba(155,127,224,0.08)' : 'transparent',
              }}
            >
              <Upload size={20} color="#9B7FE0" style={{ marginBottom: 8 }} />
              <div style={{ color: '#E4E4E7', fontSize: 13.5, fontWeight: 600 }}>Upload PDF, Word, ZIP, or text file</div>
              <div style={{ color: '#7A7A80', fontSize: 11.5, marginTop: 3 }}>or drop it here — tap to browse</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.zip,.txt,.md"
                multiple
                onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
                style={{ display: 'none' }}
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <input
                value={pasteTitle}
                onChange={(e) => setPasteTitle(e.target.value)}
                placeholder="Title (optional)"
                style={{ width: '100%', background: '#1E1E22', border: '1px solid #2C2C31', borderRadius: 10, padding: '9px 12px', color: '#F4F4F5', fontSize: 13, marginBottom: 8 }}
              />
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste text to learn from…"
                rows={4}
                style={{ width: '100%', background: '#1E1E22', border: '1px solid #2C2C31', borderRadius: 10, padding: '9px 12px', color: '#F4F4F5', fontSize: 13, resize: 'vertical' }}
              />
              <button
                onClick={submitPaste}
                disabled={!pasteText.trim()}
                style={{ marginTop: 8, width: '100%', background: pasteText.trim() ? '#F4F4F5' : '#2C2C31', color: pasteText.trim() ? '#0B0B0C' : '#6B6B70', border: 'none', borderRadius: 10, padding: '10px 0', fontWeight: 700, fontSize: 13, cursor: pasteText.trim() ? 'pointer' : 'default' }}
              >
                Add pasted text
              </button>
            </div>

            {sources.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ color: '#7A7A80', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Your sources</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sources.map((s) => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#1B1B1E', border: '1px solid #262629', borderRadius: 12, padding: '10px 12px' }}>
                      <FileText size={16} color="#9B7FE0" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#E4E4E7', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                        <div style={{ color: s.status === 'error' ? '#E06868' : '#7A7A80', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          {s.status === 'processing' && <Loader2 size={11} className="spin" />}
                          {s.status === 'processing'
                            ? 'Reading file…'
                            : s.status === 'error'
                              ? (s.error || 'Failed to process')
                              : s.postCount
                                ? `${s.postCount} lesson${s.postCount === 1 ? '' : 's'} so far`
                                : 'Ready — lessons appear as you swipe'}
                        </div>
                      </div>
                      <button onClick={() => onDeleteSource(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, flexShrink: 0 }}>
                        <Trash2 size={15} color="#7A7A80" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.9s linear infinite; }
      `}</style>
    </div>
  )
}

function TabButton({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
        background: active ? '#232327' : 'transparent', color: active ? '#F4F4F5' : '#7A7A80',
        fontSize: 13, fontWeight: 600,
      }}
    >
      {label}
    </button>
  )
}

function SyncStatus({ cloudEnabled, workspaceCode, copied, onCopy, joinCode, setJoinCode, onJoin }) {
  if (!cloudEnabled) {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#1B1B1E', border: '1px solid #262629', borderRadius: 12, padding: '10px 12px' }}>
        <CloudOff size={16} color="#7A7A80" style={{ marginTop: 1, flexShrink: 0 }} />
        <div style={{ color: '#9A9AA0', fontSize: 12, lineHeight: 1.5 }}>
          Cross-device sync isn't set up yet. Content you add here stays on this device only. Add Firebase keys to the project's <code>.env</code> to sync across devices.
        </div>
      </div>
    )
  }
  return (
    <div style={{ background: '#1B1B1E', border: '1px solid #262629', borderRadius: 12, padding: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Cloud size={15} color="#3FBBA8" />
        <span style={{ color: '#E4E4E7', fontSize: 12.5, fontWeight: 600 }}>Synced with this device's code</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, background: '#0F0F11', border: '1px solid #2C2C31', borderRadius: 8, padding: '8px 10px', color: '#F4F4F5', fontSize: 14, fontWeight: 700, letterSpacing: 1.5, fontFamily: 'monospace' }}>
          {workspaceCode}
        </div>
        <button onClick={onCopy} style={{ ...iconBtnStyle, width: 34, height: 34 }}>
          {copied ? <Check size={15} color="#3FBBA8" /> : <Copy size={15} color="#DADADA" />}
        </button>
      </div>
      <div style={{ color: '#7A7A80', fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>
        Enter this same code on your phone's Settings to see everything you upload here.
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          placeholder="Enter a code from another device"
          style={{ flex: 1, background: '#0F0F11', border: '1px solid #2C2C31', borderRadius: 8, padding: '8px 10px', color: '#F4F4F5', fontSize: 12.5 }}
        />
        <button onClick={onJoin} style={{ background: '#232327', border: 'none', borderRadius: 8, padding: '0 12px', color: '#E4E4E7', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12 }}>
          <RefreshCw size={13} /> Join
        </button>
      </div>
    </div>
  )
}

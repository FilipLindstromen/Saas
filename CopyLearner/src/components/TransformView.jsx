import React, { useState } from 'react'
import { Wand2, Copy, Check, Trash2, Loader2 } from 'lucide-react'

export default function TransformView({ transforms, onSubmit, onDelete }) {
  const [copy, setCopy] = useState('')
  const [instructions, setInstructions] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState(null)

  const submit = async () => {
    if (!copy.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      await onSubmit({ copy: copy.trim(), instructions: instructions.trim() })
      setCopy('')
    } catch (err) {
      setError(err.message || 'Failed to transform copy.')
    } finally {
      setBusy(false)
    }
  }

  const copyOutput = (t) => {
    navigator.clipboard?.writeText(t.output)
    setCopiedId(t.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '4px 4px 24px' }}>
      <div style={{ background: '#151517', border: '1px solid #232327', borderRadius: 16, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Wand2 size={16} color="#9B7FE0" />
          <span style={{ color: '#F4F4F5', fontWeight: 700, fontSize: 15, fontFamily: "'Space Grotesk', sans-serif" }}>Transform</span>
        </div>
        <p style={{ color: '#8B8B91', fontSize: 12, lineHeight: 1.5, marginTop: 0, marginBottom: 14 }}>
          Paste your copy, tell it what to do, and an expert-copywriter rewrite comes back. Every instruction you give here is remembered and applied to future transforms too.
        </p>

        <textarea
          className="select-text"
          value={copy}
          onChange={(e) => setCopy(e.target.value)}
          placeholder="Paste the copy you want transformed…"
          rows={5}
          style={{ width: '100%', background: '#1E1E22', border: '1px solid #2C2C31', borderRadius: 10, padding: '10px 12px', color: '#F4F4F5', fontSize: 13.5, resize: 'vertical', marginBottom: 10 }}
        />
        <textarea
          className="select-text"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder='Instructions — e.g. "make it punchier", "apply AIDA", "turn into 3 headline options"…'
          rows={2}
          style={{ width: '100%', background: '#1E1E22', border: '1px solid #2C2C31', borderRadius: 10, padding: '10px 12px', color: '#F4F4F5', fontSize: 13.5, resize: 'vertical' }}
        />

        <button
          onClick={submit}
          disabled={!copy.trim() || busy}
          style={{
            marginTop: 10, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: copy.trim() && !busy ? '#9B7FE0' : '#2C2C31', color: copy.trim() && !busy ? '#0B0B0C' : '#6B6B70',
            border: 'none', borderRadius: 10, padding: '11px 0', fontWeight: 700, fontSize: 13.5,
            cursor: copy.trim() && !busy ? 'pointer' : 'default',
          }}
        >
          {busy ? <Loader2 size={15} className="spin" /> : <Wand2 size={15} />}
          {busy ? 'Transforming…' : 'Transform'}
        </button>
        {error && <div style={{ color: '#E06868', fontSize: 12, marginTop: 8 }}>{error}</div>}
      </div>

      {transforms.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ color: '#7A7A80', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>History</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {transforms.map((t) => (
              <div key={t.id} style={{ background: '#151517', border: '1px solid #232327', borderRadius: 14, padding: 14 }}>
                {t.instructions && (
                  <div style={{ color: '#9B7FE0', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>{t.instructions}</div>
                )}
                <div className="select-text" style={{ color: '#E4E4E7', fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{t.output}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => copyOutput(t)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#232327', border: 'none', borderRadius: 8, padding: '6px 10px', color: '#C6C6CB', fontSize: 11.5, cursor: 'pointer' }}>
                    {copiedId === t.id ? <Check size={12} color="#3FBBA8" /> : <Copy size={12} />}
                    {copiedId === t.id ? 'Copied' : 'Copy'}
                  </button>
                  <button onClick={() => onDelete(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', borderRadius: 8, padding: '6px 10px', color: '#7A7A80', fontSize: 11.5, cursor: 'pointer' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 0.9s linear infinite; }`}</style>
    </div>
  )
}

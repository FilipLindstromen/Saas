import React from 'react'

export default function SlideBody({ slide, slideKey, accent, revealed, setRevealed, quizPick, setQuizPick }) {
  const isRevealed = !!revealed[slideKey]

  if (slide.kind === 'title') {
    return (
      <div>
        <div className="select-text" style={{ fontSize: 12, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>{slide.kicker}</div>
        <div className="select-text" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 30, lineHeight: 1.15, color: '#F4F4F5' }}>{slide.heading}</div>
      </div>
    )
  }

  if (slide.kind === 'point') {
    return (
      <div>
        <div className="select-text" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 21, lineHeight: 1.25, color: '#F4F4F5', marginBottom: 12 }}>{slide.heading}</div>
        <div className="select-text" style={{ fontSize: 15.5, lineHeight: 1.55, color: '#C6C6CB' }}>{slide.body}</div>
      </div>
    )
  }

  if (slide.kind === 'example') {
    return (
      <div>
        <div className="select-text" style={{ fontSize: 12, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>{slide.label}</div>
        {slide.before && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#6B6B70', marginBottom: 4 }}>BEFORE</div>
            <div className="select-text" style={{ fontSize: 15, color: '#7C7C82', textDecoration: 'line-through', lineHeight: 1.4 }}>{slide.before}</div>
          </div>
        )}
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: accent, marginBottom: 4 }}>{slide.before ? 'AFTER' : 'EXAMPLE'}</div>
          <div className="select-text" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, color: '#F4F4F5', lineHeight: 1.4 }}>{slide.after}</div>
        </div>
      </div>
    )
  }

  if (slide.kind === 'quiz') {
    return (
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Quick check</div>
        <div className="select-text" style={{ fontSize: 17, fontWeight: 600, color: '#F4F4F5', lineHeight: 1.4, marginBottom: 16 }}>{slide.prompt}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {slide.options.map((opt, i) => {
            const picked = quizPick === i
            const showResult = quizPick !== null
            const isCorrect = i === slide.correct
            let bg = '#232327', border = 'transparent', color = '#C6C6CB'
            if (showResult && isCorrect) { bg = 'rgba(63,187,168,0.15)'; border = '#3FBBA8' }
            else if (showResult && picked && !isCorrect) { bg = 'rgba(224,104,104,0.15)'; border = '#E06868' }
            return (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setQuizPick(i) }}
                style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 12, background: bg, border: `1.5px solid ${border}`, fontSize: 14, color, cursor: 'pointer', zIndex: 5, position: 'relative' }}
              >
                {opt}
              </button>
            )
          })}
        </div>
        {quizPick !== null && (
          <div className="select-text" style={{ marginTop: 14, fontSize: 13.5, color: '#B0B0B6', lineHeight: 1.5, background: '#1E1E22', padding: '10px 12px', borderRadius: 10 }}>{slide.explanation}</div>
        )}
      </div>
    )
  }

  if (slide.kind === 'challenge') {
    return (
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Try it yourself</div>
        <div className="select-text" style={{ fontSize: 17, fontWeight: 600, color: '#F4F4F5', lineHeight: 1.4, marginBottom: 8 }}>{slide.prompt}</div>
        <div className="select-text" style={{ fontSize: 13, color: '#8B8B91', marginBottom: 16 }}>{slide.hint}</div>
        {!isRevealed ? (
          <button
            onClick={(e) => { e.stopPropagation(); setRevealed((r) => ({ ...r, [slideKey]: true })) }}
            style={{ background: accent, color: '#0B0B0C', border: 'none', borderRadius: 12, padding: '11px 18px', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', zIndex: 5, position: 'relative' }}
          >
            Think it through, then tap to compare
          </button>
        ) : (
          <div style={{ background: '#1E1E22', padding: '12px 14px', borderRadius: 10 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: accent, marginBottom: 4 }}>ONE WAY TO ANSWER IT</div>
            <div className="select-text" style={{ fontSize: 14.5, color: '#C6C6CB', lineHeight: 1.5 }}>{slide.modelAnswer}</div>
          </div>
        )}
      </div>
    )
  }

  if (slide.kind === 'takeaway') {
    return (
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Takeaway</div>
        <div className="select-text" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 19, fontWeight: 700, color: '#F4F4F5', lineHeight: 1.4 }}>{slide.body}</div>
      </div>
    )
  }

  return null
}

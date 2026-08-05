import React from 'react'
import { Star, Check, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import SlideBody from './SlideBody.jsx'

export default function PostCard({
  post, slide, slideIdx, accent, label, isFav,
  revealed, setRevealed, quizPick, setQuizPick,
  onToggleFav, onRate, isLastSlide,
}) {
  const total = post.slides.length

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: '#17171A', borderRadius: 22, overflow: 'hidden', position: 'relative',
      boxShadow: '0 20px 60px rgba(0,0,0,0.6)', border: '1px solid #232327',
    }}>
      {/* story progress segments */}
      <div style={{ display: 'flex', gap: 4, padding: '10px 12px 0' }}>
        {post.slides.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < slideIdx ? accent : i === slideIdx ? '#5A5A60' : '#28282C' }} />
        ))}
      </div>

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 0' }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: accent, textTransform: 'uppercase' }}>{label}</span>
        <button onClick={onToggleFav} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <Star size={19} color={isFav ? accent : '#55555B'} fill={isFav ? accent : 'none'} />
        </button>
      </div>

      {/* slide content — text within it is selectable; swipe (left/right/up/down) and
          arrow keys handle navigation instead of tap zones, so selecting text with a
          click-drag doesn't compete with an overlay for the pointer */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <div style={{ height: '100%', overflowY: 'auto', padding: '18px 22px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <SlideBody
            slide={slide}
            slideKey={`${post.id}-${slideIdx}`}
            accent={accent}
            revealed={revealed}
            setRevealed={setRevealed}
            quizPick={quizPick}
            setQuizPick={setQuizPick}
          />
        </div>
      </div>

      {/* nav chevrons (visual affordance — swipe handles the actual nav) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 10px 10px', pointerEvents: 'none' }}>
        <ChevronLeft size={16} color={slideIdx > 0 ? '#4E4E54' : 'transparent'} />
        <span style={{ fontSize: 10.5, color: '#4E4E54' }}>{slideIdx + 1} / {total}</span>
        <ChevronRight size={16} color="#4E4E54" />
      </div>

      {/* rating footer only on the last slide */}
      {isLastSlide && (
        <div style={{ display: 'flex', gap: 8, padding: '0 16px 16px' }}>
          <button onClick={(e) => { e.stopPropagation(); onRate(false) }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#232327', border: 'none', borderRadius: 12, padding: '10px 0', fontWeight: 600, fontSize: 13, color: '#C6C6CB', cursor: 'pointer', zIndex: 5, position: 'relative' }}>
            <RotateCcw size={14} /> Review again soon
          </button>
          <button onClick={(e) => { e.stopPropagation(); onRate(true) }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#F4F4F5', border: 'none', borderRadius: 12, padding: '10px 0', fontWeight: 700, fontSize: 13, color: '#0B0B0C', cursor: 'pointer', zIndex: 5, position: 'relative' }}>
            <Check size={14} /> Got it
          </button>
        </div>
      )}
    </div>
  )
}

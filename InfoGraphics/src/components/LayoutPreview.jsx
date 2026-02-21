/**
 * Mini SVG preview of each layout. Canvas is 800x450, preview scales to ~100x56.
 */
const S = 800 / 100  // scale factor: 8
const W = 100
const H = 56

function rect(x, y, w, h) {
  return { x: x / S, y: y / S, width: w / S, height: h / S, rx: 2, fill: 'none', stroke: 'currentColor', strokeWidth: 1 }
}

function arrowRight(cx, cy) {
  const x = cx / S
  const y = cy / S
  const len = 12
  return (
    <g key={`arrow-${cx}-${cy}`} stroke="currentColor" strokeWidth="1" fill="none">
      <line x1={x - len / 2} y1={y} x2={x + len / 2} y2={y} />
      <polygon points={`${x + len / 2},${y} ${x + len / 2 - 4},${y - 3} ${x + len / 2 - 4},${y + 3}`} fill="currentColor" />
    </g>
  )
}

function arrowDown(cx, cy) {
  const x = cx / S
  const y = cy / S
  const len = 10
  return (
    <g key={`arrow-${cx}-${cy}`} stroke="currentColor" strokeWidth="1" fill="none">
      <line x1={x} y1={y - len / 2} x2={x} y2={y + len / 2} />
      <polygon points={`${x},${y + len / 2} ${x - 3},${y + len / 2 - 4} ${x + 3},${y + len / 2 - 4}`} fill="currentColor" />
    </g>
  )
}

const PREVIEWS = {
  '3-step-h': (
    <svg viewBox={`0 0 ${W} ${H}`} className="layout-preview-svg">
      <rect {...rect(50, 150, 180, 140)} />
      {arrowRight(245, 220)}
      <rect {...rect(330, 150, 180, 140)} />
      {arrowRight(505, 220)}
      <rect {...rect(610, 150, 140, 140)} />
    </svg>
  ),
  '5-step-v': (
    <svg viewBox={`0 0 ${W} ${H}`} className="layout-preview-svg">
      <rect {...rect(80, 50, 200, 70)} />
      {arrowDown(180, 125)}
      <rect {...rect(80, 130, 200, 70)} />
      {arrowDown(180, 205)}
      <rect {...rect(80, 210, 200, 70)} />
      {arrowDown(180, 285)}
      <rect {...rect(80, 290, 200, 70)} />
      {arrowDown(180, 365)}
      <rect {...rect(80, 370, 200, 70)} />
    </svg>
  ),
  'hero': (
    <svg viewBox={`0 0 ${W} ${H}`} className="layout-preview-svg">
      <rect {...rect(150, 80, 500, 60)} />
      <rect {...rect(300, 160, 200, 200)} />
      <rect {...rect(310, 380, 180, 48)} />
    </svg>
  ),
  '2-col': (
    <svg viewBox={`0 0 ${W} ${H}`} className="layout-preview-svg">
      <rect {...rect(150, 40, 500, 50)} />
      <rect {...rect(80, 110, 300, 280)} />
      <rect {...rect(420, 110, 300, 280)} />
    </svg>
  ),
  '4-grid': (
    <svg viewBox={`0 0 ${W} ${H}`} className="layout-preview-svg">
      <rect {...rect(50, 50, 340, 170)} />
      {arrowRight(420, 135)}
      <rect {...rect(410, 50, 340, 170)} />
      {arrowDown(255, 225)}
      {arrowDown(585, 225)}
      <rect {...rect(50, 230, 340, 170)} />
      {arrowRight(420, 315)}
      <rect {...rect(410, 230, 340, 170)} />
    </svg>
  ),
  '3-step-arrows': (
    <svg viewBox={`0 0 ${W} ${H}`} className="layout-preview-svg">
      <rect {...rect(50, 150, 150, 140)} />
      {arrowRight(245, 220)}
      <rect {...rect(310, 150, 150, 140)} />
      {arrowRight(505, 220)}
      <rect {...rect(570, 150, 150, 140)} />
    </svg>
  ),
  'title-3': (
    <svg viewBox={`0 0 ${W} ${H}`} className="layout-preview-svg">
      <rect {...rect(150, 30, 500, 50)} />
      <rect {...rect(50, 100, 220, 300)} />
      {arrowRight(215, 250)}
      <rect {...rect(290, 100, 220, 300)} />
      {arrowRight(455, 250)}
      <rect {...rect(530, 100, 220, 300)} />
    </svg>
  ),
  '6-grid': (
    <svg viewBox={`0 0 ${W} ${H}`} className="layout-preview-svg">
      <rect {...rect(30, 30, 235, 125)} />
      {arrowRight(252, 92)}
      <rect {...rect(277, 30, 235, 125)} />
      {arrowRight(499, 92)}
      <rect {...rect(524, 30, 235, 125)} />
      {arrowDown(147, 192)}
      {arrowDown(394, 192)}
      {arrowDown(641, 192)}
      <rect {...rect(30, 167, 235, 125)} />
      {arrowRight(252, 229)}
      <rect {...rect(277, 167, 235, 125)} />
      {arrowRight(499, 229)}
      <rect {...rect(524, 167, 235, 125)} />
    </svg>
  ),
  'single-focus': (
    <svg viewBox={`0 0 ${W} ${H}`} className="layout-preview-svg">
      <rect {...rect(100, 40, 600, 50)} />
      <rect {...rect(250, 110, 300, 250)} />
      <rect {...rect(310, 380, 180, 48)} />
    </svg>
  ),
  'before-after': (
    <svg viewBox={`0 0 ${W} ${H}`} className="layout-preview-svg">
      <rect {...rect(80, 120, 250, 200)} />
      {arrowRight(405, 220)}
      <rect {...rect(470, 120, 250, 200)} />
    </svg>
  )
}

export default function LayoutPreview({ layoutId, elements }) {
  if (elements && elements.length > 0) {
    const S = 800 / 100
    const W = 100
    const H = 56
    return (
      <div className="layout-preview">
        <svg viewBox={`0 0 ${W} ${H}`} className="layout-preview-svg">
          {elements.slice(0, 12).map((e, i) => (
            <rect
              key={i}
              x={(e.x || 0) / S}
              y={(e.y || 0) / S}
              width={(e.width || 100) / S}
              height={(e.height || 80) / S}
              rx={2}
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
            />
          ))}
        </svg>
      </div>
    )
  }
  const preview = PREVIEWS[layoutId]
  if (!preview) return null
  return (
    <div className="layout-preview">
      {preview}
    </div>
  )
}

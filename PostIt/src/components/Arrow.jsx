import { useMemo, useState } from 'react';
import { getHandDrawnPath } from '../utils/handDrawnPath';
import './Arrow.css';

function getEdgePoint(rect, side) {
  if (!rect) return { x: 0, y: 0 };
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  switch (side) {
    case 'top': return { x: cx, y: rect.y };
    case 'right': return { x: rect.x + rect.width, y: cy };
    case 'bottom': return { x: cx, y: rect.y + rect.height };
    case 'left': return { x: rect.x, y: cy };
    default: return { x: cx, y: rect.y + rect.height };
  }
}

export function Arrow({ id, fromRect, toRect, fromSide = 'bottom', toSide = 'top', theme, connectMode, onDelete }) {
  const [hovered, setHovered] = useState(false);

  const { path, from, to, midpoint } = useMemo(() => {
    if (!fromRect || !toRect) return { path: '', from: null, to: null, midpoint: null };
    const f = getEdgePoint(fromRect, fromSide);
    const t = getEdgePoint(toRect, toSide);
    const p = getHandDrawnPath(f.x, f.y, t.x, t.y);
    const mid = { x: (f.x + t.x) / 2, y: (f.y + t.y) / 2 };
    return { path: p, from: f, to: t, midpoint: mid };
  }, [fromRect, toRect, fromSide, toSide]);

  if (!path) return null;

  const showDelete = connectMode && hovered && onDelete;

  return (
    <g
      className="arrow-group"
      onMouseEnter={() => connectMode && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <path
        className={`arrow-path arrow-path--${theme}`}
        d={path}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {connectMode && (
        <path
          className="arrow-hit"
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth="20"
          strokeLinecap="round"
          pointerEvents="stroke"
        />
      )}
      {showDelete && midpoint && (
        <g
          className="arrow-delete"
          transform={`translate(${midpoint.x}, ${midpoint.y})`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(id);
          }}
          role="button"
          aria-label="Delete connection"
          title="Delete connection"
        >
          <circle r="12" className="arrow-delete-circle" />
          <line x1="-5" y1="-5" x2="5" y2="5" className="arrow-delete-x" />
          <line x1="5" y1="-5" x2="-5" y2="5" className="arrow-delete-x" />
        </g>
      )}
    </g>
  );
}

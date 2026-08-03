import { applyHeadlineToLineText } from '../utils/lineReveal';

export default function PresentRotateLines({ rows, styledParts, fontSize, lineHeight, animKey }) {
  if (!rows?.length) return null;

  return (
    <div
      className="present-rotate"
      style={{ fontSize, lineHeight }}
      aria-live="polite"
    >
      {rows.map((row, index) => {
        if (row.kind === 'static') {
          return (
            <p key={`s-${index}`} className="present-rotate__static">
              {row.text}
            </p>
          );
        }
        const parts = applyHeadlineToLineText(row.text, styledParts);
        const animate = row.animate;
        const isBullet = row.variant === 'bullet';
        return (
          <div
            key={`l-${index}-${animKey}`}
            className={[
              'present-rotate__mask',
              isBullet && 'present-rotate__mask--bullet',
              animate && 'present-rotate__mask--animate',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div
              className={[
                'present-rotate__line',
                isBullet && 'present-rotate__line--bullet',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {parts.map((part, pi) =>
                part.headline ? (
                  <span key={pi} className="present-view__headline">
                    {part.text}
                  </span>
                ) : (
                  <span key={pi}>{part.text}</span>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

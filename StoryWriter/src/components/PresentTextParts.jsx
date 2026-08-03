export function PresentTextParts({ parts }) {
  if (!parts?.length) return null;
  return parts.map((part, i) => {
    const className = [
      part.headline && 'present-view__headline',
      part.emphasis && 'present-view__emphasis',
      part.caption && 'present-view__caption',
      part.large && 'present-view__type-large',
      part.whisper && 'present-view__type-whisper',
    ]
      .filter(Boolean)
      .join(' ');
    return className ? (
      <span key={i} className={className}>
        {part.text}
      </span>
    ) : (
      <span key={i}>{part.text}</span>
    );
  });
}

import { splitAtOrp } from '../lib/orp';

export default function WordDisplay({ token, focusColor, bgColor, hint, colorHint = false, language = 'en' }) {
  const stageClass = `word-stage${bgColor ? ' word-stage--tinted' : ''}`;
  const stageStyle = bgColor ? { backgroundColor: bgColor } : undefined;

  if (!token) {
    return (
      <div className={stageClass} style={stageStyle}>
        <div className="word-row idle">Ready</div>
      </div>
    );
  }

  if (token.type === 'gap') {
    return <div className={stageClass} style={stageStyle} aria-label="Recall the translation" />;
  }

  const { pre, focus, post } = splitAtOrp(token.text);
  // Longest side of the word; the CSS shrinks the font so it still fits each
  // half of the row, which keeps the focus letter centered on narrow screens.
  const sideChars = Math.max(pre.length, post.length);

  return (
    <div className={stageClass} style={stageStyle}>
      <div className="word-center">
        {hint && (
          <div className="word-hint" lang="sv" style={bgColor || colorHint ? { color: focusColor } : undefined}>
            {hint}
          </div>
        )}
        <div className="reticle-tick reticle-tick-top" />
        <div lang={token.lang === 'sv' ? 'sv' : language} className={`word-row${token.text.includes(' ') ? ' word-row--phrase' : ''}`} style={{ '--side-chars': sideChars }}>
          <span className="word-pre">{pre}</span>
          <span className="word-focus" style={{ color: focusColor }}>
            {focus}
          </span>
          <span className="word-post">{post}</span>
        </div>
      </div>
    </div>
  );
}

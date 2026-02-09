import { useState, useRef, useCallback, useEffect } from 'react';
import './Comment.css';

export function Comment({ id, x, y, text, fontFamily, theme, snapMode, snapGrid, selected, connectMode, onMove, onTextChange, onSelect, onDelete, onConnectStart }) {
  const [editing, setEditing] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const textRef = useRef(null);

  const snap = useCallback((v) => (snapMode ? Math.round(v / snapGrid) * snapGrid : v), [snapMode, snapGrid]);

  const handlePointerDown = (e) => {
    if (e.target.closest('.comment-text')) return;
    if (connectMode) {
      onConnectStart?.(id, 'comment');
      return;
    }
    e.preventDefault();
    onSelect?.(id);
    setDragStart({ x: e.clientX - x, y: e.clientY - y });
  };

  const handlePointerMove = useCallback(
    (e) => {
      if (dragStart != null) {
        const nx = Math.max(0, e.clientX - dragStart.x);
        const ny = Math.max(0, e.clientY - dragStart.y);
        onMove?.(id, snap(nx), snap(ny));
      }
    },
    [dragStart, id, onMove, snap]
  );

  const handlePointerUp = useCallback(() => setDragStart(null), []);

  useEffect(() => {
    if (dragStart == null) return;
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragStart, handlePointerMove, handlePointerUp]);

  const handleDoubleClick = () => setEditing(true);
  const handleBlur = () => {
    setEditing(false);
    const newText = textRef.current?.innerText?.trim() ?? text;
    onTextChange?.(id, newText);
  };

  return (
    <div
      className={`comment comment--${theme} ${selected ? 'comment--selected' : ''} ${connectMode ? 'comment--connect' : ''}`}
      style={{ left: x, top: y, fontFamily }}
      onPointerDown={handlePointerDown}
      data-id={id}
      data-type="comment"
    >
      {connectMode && (
        <>
          <button type="button" className="comment-connector comment-connector--top" title="Connect from top" onPointerDown={(e) => handleConnectorClick(e, 'top')} aria-label="Connect from top" />
          <button type="button" className="comment-connector comment-connector--right" title="Connect from right" onPointerDown={(e) => handleConnectorClick(e, 'right')} aria-label="Connect from right" />
          <button type="button" className="comment-connector comment-connector--bottom" title="Connect from bottom" onPointerDown={(e) => handleConnectorClick(e, 'bottom')} aria-label="Connect from bottom" />
          <button type="button" className="comment-connector comment-connector--left" title="Connect from left" onPointerDown={(e) => handleConnectorClick(e, 'left')} aria-label="Connect from left" />
        </>
      )}
      <div
        ref={textRef}
        className="comment-text"
        contentEditable={editing}
        suppressContentEditableWarning
        onDoubleClick={handleDoubleClick}
        onBlur={handleBlur}
        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), textRef.current?.blur())}
      >
        {text}
      </div>
    </div>
  );
}

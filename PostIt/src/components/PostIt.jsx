import { useState, useRef, useCallback, useEffect } from 'react';
import { POSTIT_COLORS, POSTIT_WIDTH, POSTIT_MIN_HEIGHT } from '../constants';
import { POSTIT_ICONS, getIconById, DEFAULT_ICON_ID } from '../constants/icons';
import './PostIt.css';

export function PostIt({
  id,
  x,
  y,
  height,
  text,
  icon: iconId,
  colorIndex,
  fontFamily,
  theme,
  snapMode,
  snapGrid,
  selected,
  connectMode,
  onMove,
  onTextChange,
  onIconChange,
  onHeightChange,
  onSelect,
  onConnectStart,
  isConnectSource,
}) {
  const [editing, setEditing] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const textRef = useRef(null);
  const containerRef = useRef(null);
  const icon = getIconById(iconId);

  const color = POSTIT_COLORS[colorIndex % POSTIT_COLORS.length];

  const snap = useCallback(
    (v) => (snapMode ? Math.round(v / snapGrid) * snapGrid : v),
    [snapMode, snapGrid]
  );

  const handlePointerDown = (e) => {
    if (e.target.closest('.postit-text') || e.target.closest('.postit-pin') || e.target.closest('.postit-connector') || e.target.closest('.postit-icon-wrap') || e.target.closest('.postit-icon-picker')) return;
    if (connectMode) return;
    e.preventDefault();
    onSelect?.(id);
    setDragStart({ x: e.clientX - x, y: e.clientY - y });
  };

  const handleConnectorClick = (e, side) => {
    e.stopPropagation();
    onConnectStart?.(id, 'note', side);
  };

  const handlePointerMove = useCallback(
    (e) => {
      if (dragStart != null) {
        let nx = e.clientX - dragStart.x;
        let ny = e.clientY - dragStart.y;
        nx = Math.max(0, nx);
        ny = Math.max(0, ny);
        onMove?.(id, snap(nx), snap(ny));
      }
    },
    [dragStart, id, onMove, snap]
  );

  const handlePointerUp = useCallback(() => {
    setDragStart(null);
  }, []);

  useEffect(() => {
    if (dragStart == null) return;
    const up = () => handlePointerUp();
    const move = (e) => handlePointerMove(e);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [dragStart, handlePointerMove, handlePointerUp]);

  useEffect(() => {
    if (!containerRef.current || !onHeightChange) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const h = entry.contentRect.height;
        if (h > 0) onHeightChange(id, Math.max(POSTIT_MIN_HEIGHT, Math.ceil(h)));
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [id, onHeightChange]);

  useEffect(() => {
    if (!iconPickerOpen) return;
    const close = (e) => {
      if (e.target.closest('.postit-icon-wrap') || e.target.closest('.postit-icon-picker')) return;
      setIconPickerOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [iconPickerOpen]);

  const handleDoubleClick = () => setEditing(true);
  const handleBlur = () => {
    setEditing(false);
    onTextChange?.(id, textRef.current?.innerText ?? text);
  };

  return (
    <div
      ref={containerRef}
      className={`postit postit--${theme} ${selected ? 'postit--selected' : ''} ${isConnectSource ? 'postit--connect-source' : ''}`}
      style={{
        left: x,
        top: y,
        fontFamily,
        background: color.gradient,
        '--postit-pin': color.pin,
        '--postit-num': color.num,
      }}
      onPointerDown={handlePointerDown}
      data-id={id}
      data-type="note"
    >
      {connectMode && <div className="postit-pin" aria-hidden />}
      {connectMode && (
        <>
          <button type="button" className="postit-connector postit-connector--top" title="Connect from top" onPointerDown={(e) => handleConnectorClick(e, 'top')} aria-label="Connect from top" />
          <button type="button" className="postit-connector postit-connector--right" title="Connect from right" onPointerDown={(e) => handleConnectorClick(e, 'right')} aria-label="Connect from right" />
          <button type="button" className="postit-connector postit-connector--bottom" title="Connect from bottom" onPointerDown={(e) => handleConnectorClick(e, 'bottom')} aria-label="Connect from bottom" />
          <button type="button" className="postit-connector postit-connector--left" title="Connect from left" onPointerDown={(e) => handleConnectorClick(e, 'left')} aria-label="Connect from left" />
        </>
      )}
      <div
        className="postit-icon-wrap"
        onClick={(e) => { e.stopPropagation(); setIconPickerOpen((o) => !o); }}
        title="Change icon"
      >
        {icon.id !== 'none' ? (
          <span className="material-symbols-outlined postit-icon" aria-hidden>{icon.id}</span>
        ) : (
          <span className="postit-icon-placeholder">+</span>
        )}
        {iconPickerOpen && (
          <div className="postit-icon-picker" onPointerDown={(e) => e.stopPropagation()}>
            {POSTIT_ICONS.map((i) => (
              <button
                key={i.id}
                type="button"
                className={`postit-icon-picker-item ${(iconId ?? DEFAULT_ICON_ID) === i.id ? 'active' : ''}`}
                onClick={() => { onIconChange?.(id, i.id); setIconPickerOpen(false); }}
                title={i.name}
              >
                {i.id !== 'none' ? (
                  <span className="material-symbols-outlined postit-icon-picker-glyph" aria-hidden>{i.id}</span>
                ) : (
                  <span className="postit-icon-none">—</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      <div
        ref={textRef}
        className="postit-text"
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

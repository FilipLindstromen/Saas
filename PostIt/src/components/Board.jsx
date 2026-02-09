import { useRef, useState, useCallback, useEffect } from 'react';
import { PostIt } from './PostIt';
import { Comment } from './Comment';
import { Arrow } from './Arrow';
import { POSTIT_COLORS, POSTIT_WIDTH, POSTIT_MIN_HEIGHT } from '../constants';
import { DEFAULT_ICON_ID } from '../constants/icons';
import { SNAP_GRID } from '../constants';
import './Board.css';

const genId = () => `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function getRect(item, type) {
  if (type === 'note') return { x: item.x, y: item.y, width: POSTIT_WIDTH, height: item.height ?? POSTIT_MIN_HEIGHT };
  return { x: item.x, y: item.y, width: item.width ?? 180, height: item.height ?? 50 };
}

export function Board({
  notes,
  comments,
  arrows,
  theme,
  fontFamily,
  snapMode,
  selectedId,
  selectedType,
  connectMode,
  connectSource,
  onUpdatePage,
  onSelect,
}) {
  const boardRef = useRef(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState(null);

  const getBoardPoint = useCallback((e) => {
    const el = boardRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return { x: e.clientX - rect.left - pan.x, y: e.clientY - rect.top - pan.y };
  }, [pan]);

  const handleCanvasPointerDown = (e) => {
    if (e.target !== boardRef.current && !e.target.closest('.board-content')) return;
    if (e.target.closest('.postit, .comment')) return;
    if (connectMode) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handlePointerMove = useCallback(
    (e) => {
      if (isPanning && panStart != null) {
        setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      }
    },
    [isPanning, panStart]
  );

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
    setPanStart(null);
  }, []);

  useEffect(() => {
    if (!isPanning) return;
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isPanning, handlePointerMove, handlePointerUp]);

  const addNote = (e) => {
    const { x, y } = getBoardPoint(e);
    const snappedX = snapMode ? Math.round(x / SNAP_GRID) * SNAP_GRID : x;
    const snappedY = snapMode ? Math.round(y / SNAP_GRID) * SNAP_GRID : y;
    onUpdatePage?.((draft) => {
      draft.notes.push({
        id: genId(),
        x: Math.max(0, snappedX),
        y: Math.max(0, snappedY),
        width: POSTIT_WIDTH,
        height: POSTIT_MIN_HEIGHT,
        text: 'New note',
        icon: DEFAULT_ICON_ID,
        colorIndex: Math.floor(Math.random() * POSTIT_COLORS.length),
      });
    }, { pushHistory: true });
  };

  const updateNote = (id, updates, push) => {
    onUpdatePage?.((draft) => {
      const n = draft.notes.find((x) => x.id === id);
      if (n) Object.assign(n, updates);
    }, push ? { pushHistory: true } : undefined);
  };

  const updateComment = (id, updates, push) => {
    onUpdatePage?.((draft) => {
      const c = draft.comments.find((x) => x.id === id);
      if (c) Object.assign(c, updates);
    }, push ? { pushHistory: true } : undefined);
  };

  const noteRects = Object.fromEntries(notes.map((n) => [n.id, getRect(n, 'note')]));
  const commentRects = Object.fromEntries(comments.map((c) => [c.id, getRect(c, 'comment')]));

  return (
    <div
      className={`board board--${theme}`}
      style={{ '--postit-width': `${POSTIT_WIDTH}px`, '--postit-min-height': `${POSTIT_MIN_HEIGHT}px` }}
    >
      <div
        ref={boardRef}
        className="board-viewport"
        onPointerDown={handleCanvasPointerDown}
        style={{ cursor: isPanning ? 'grabbing' : connectMode ? 'crosshair' : 'grab' }}
      >
        <div className="board-content" style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
          <div className="board-grid" aria-hidden />
          <svg className={`board-arrows ${connectMode ? 'board-arrows--interactive' : ''}`} width="10000" height="10000">
            {arrows.map((arr) => {
              const fromRect = arr.fromType === 'note' ? noteRects[arr.fromId] : commentRects[arr.fromId];
              const toRect = arr.toType === 'note' ? noteRects[arr.toId] : commentRects[arr.toId];
              if (!fromRect || !toRect) return null;
              return (
                <Arrow
                  key={arr.id}
                  id={arr.id}
                  fromRect={fromRect}
                  toRect={toRect}
                  fromSide={arr.fromSide}
                  toSide={arr.toSide}
                  theme={theme}
                  connectMode={connectMode}
                  onDelete={connectMode ? (arrowId) => {
                    onUpdatePage?.((draft) => {
                      draft.arrows = draft.arrows.filter((a) => a.id !== arrowId);
                    }, { pushHistory: true });
                  } : undefined}
                />
              );
            })}
          </svg>
          <div className={`board-click-layer ${connectMode ? 'board-click-layer--passthrough' : ''}`} onDoubleClick={addNote} title="Double-click to add a note" />
          {notes.map((note) => (
            <PostIt
              key={note.id}
              {...note}
              fontFamily={fontFamily}
              theme={theme}
              snapMode={snapMode}
              snapGrid={SNAP_GRID}
              selected={selectedId === note.id && selectedType === 'note'}
              connectMode={connectMode}
              isConnectSource={connectSource?.id === note.id && connectSource?.type === 'note'}
              onMove={(id, nx, ny) => updateNote(id, { x: nx, y: ny }, true)}
              onTextChange={(id, t) => updateNote(id, { text: t }, true)}
              onIconChange={(id, icon) => updateNote(id, { icon }, true)}
              onHeightChange={(id, h) => updateNote(id, { height: h }, false)}
              onSelect={(id) => onSelect?.(id, 'note')}
              onConnectStart={(id, type, side) => onSelect?.({ id, type, side }, 'connect')}
            />
          ))}
          {comments.map((comment) => (
            <Comment
              key={comment.id}
              {...comment}
              fontFamily={fontFamily}
              theme={theme}
              snapMode={snapMode}
              snapGrid={SNAP_GRID}
              selected={selectedId === comment.id && selectedType === 'comment'}
              connectMode={connectMode}
              onMove={(id, nx, ny) => updateComment(id, { x: nx, y: ny }, true)}
              onTextChange={(id, t) => updateComment(id, { text: t }, true)}
              onSelect={(id) => onSelect?.(id, 'comment')}
              onConnectStart={(id, type, side) => onSelect?.({ id, type, side }, 'connect')}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef } from 'react';
import './TextContextMenu.css';

export default function TextContextMenu({ open, x, y, items, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (ref.current?.contains(e.target)) return;
      onClose?.();
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="text-context-menu"
      style={{ left: x, top: y }}
      role="menu"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="text-context-menu__item"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            if (!item.disabled) item.onClick?.();
            onClose?.();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

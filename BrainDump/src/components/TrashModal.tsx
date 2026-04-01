"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatAreaLabel } from "@/lib/personal-areas";

type TrashedRow = {
  id: string;
  domain: string;
  category: string;
  title: string;
  deletedAt?: string | null;
  project?: { id: string; name: string } | null;
};

interface TrashModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TrashModal({ isOpen, onClose }: TrashModalProps) {
  const { t } = useI18n();
  const [items, setItems] = useState<TrashedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const r = await fetch("/api/organized-items?trashed=true");
      const data = (await r.json()) as { items?: TrashedRow[]; error?: string };
      if (!r.ok) throw new Error(data.error || "load failed");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setLoadError(t("trash.loadError"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!isOpen) return;
    void load();
  }, [isOpen, load]);

  const restore = async (id: string) => {
    setBusyId(id);
    try {
      const r = await fetch(`/api/organized-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: true }),
      });
      if (r.ok) {
        setItems((prev) => prev.filter((it) => it.id !== id));
        window.dispatchEvent(new Event("braindump-reload-items"));
      }
    } finally {
      setBusyId(null);
    }
  };

  const deleteForever = async (id: string) => {
    if (!confirm(t("trash.deleteForeverConfirm"))) return;
    setBusyId(id);
    try {
      const r = await fetch(`/api/organized-items/${id}?permanent=true`, { method: "DELETE" });
      if (r.ok) {
        setItems((prev) => prev.filter((it) => it.id !== id));
        window.dispatchEvent(new Event("braindump-reload-items"));
      }
    } finally {
      setBusyId(null);
    }
  };

  const emptyTrash = async () => {
    if (items.length === 0) return;
    if (!confirm(t("trash.emptyTrashConfirm", { count: items.length }))) return;
    setPurging(true);
    try {
      const r = await fetch("/api/organized-items/purge-trash", { method: "POST" });
      if (r.ok) {
        setItems([]);
        window.dispatchEvent(new Event("braindump-reload-items"));
        onClose();
      }
    } finally {
      setPurging(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bd-trash-title"
      className="bd-modal-backdrop bd-trash-modal-backdrop"
      onClick={onClose}
    >
      <div className="bd-modal-panel bd-trash-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="bd-trash-modal-head">
          <h2 id="bd-trash-title" className="bd-trash-modal-title">
            {t("trash.title")}
          </h2>
          <button type="button" className="bd-btn bd-trash-modal-close" onClick={onClose} aria-label={t("center.close")}>
            ×
          </button>
        </div>
        <p className="bd-trash-modal-intro">{t("trash.intro")}</p>

        {loading ? (
          <p className="bd-trash-modal-muted">{t("trash.loading")}</p>
        ) : loadError ? (
          <p className="bd-trash-modal-error" role="alert">
            {loadError}
          </p>
        ) : items.length === 0 ? (
          <p className="bd-trash-modal-muted">{t("trash.empty")}</p>
        ) : (
          <ul className="bd-trash-list">
            {items.map((it) => {
              const b = busyId === it.id;
              return (
                <li key={it.id} className="bd-trash-row">
                  <div className="bd-trash-row-main">
                    <span className="bd-trash-row-title">{it.title?.trim() || "—"}</span>
                    <span className="bd-trash-row-meta">
                      {it.domain === "work" ? t("mode.work") : it.domain === "personal" ? t("mode.personal") : it.domain}
                      {it.project?.name ? ` · ${it.project.name}` : ""}
                      {it.category ? ` · ${formatAreaLabel(it.category)}` : ""}
                    </span>
                  </div>
                  <div className="bd-trash-row-actions">
                    <button
                      type="button"
                      className="bd-btn bd-trash-restore"
                      disabled={b || purging}
                      onClick={() => void restore(it.id)}
                    >
                      {t("trash.restore")}
                    </button>
                    <button
                      type="button"
                      className="bd-btn bd-trash-delete-forever"
                      disabled={b || purging}
                      onClick={() => void deleteForever(it.id)}
                    >
                      {t("trash.deleteForever")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {items.length > 0 ? (
          <div className="bd-trash-modal-footer">
            <button type="button" className="bd-btn bd-trash-empty" disabled={purging} onClick={() => void emptyTrash()}>
              {purging ? t("trash.emptying") : t("trash.emptyTrash")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

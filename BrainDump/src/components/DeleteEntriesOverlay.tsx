"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useI18n } from "@/lib/i18n";

type DeleteCatalog = {
  completedTasks: number;
  reflections: number;
  shopping: number;
  emptyProjectCount: number;
};

function deleteSelectionKeyToScope(key: string): object | null {
  if (key === "completed_tasks") return { type: "completed_tasks" };
  if (key === "reflection") return { type: "item_type", itemType: "reflection" };
  if (key === "shopping") return { type: "item_type", itemType: "shopping" };
  return null;
}

interface DeleteEntriesOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DeleteEntriesOverlay({ isOpen, onClose }: DeleteEntriesOverlayProps) {
  const { t } = useI18n();
  const [catalog, setCatalog] = useState<DeleteCatalog | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [deletingEmptyProjects, setDeletingEmptyProjects] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedKey(null);
    setSelectedLabel("");
    setActionError(null);
    setLoadError(null);
    setCatalog(null);
    setLoading(true);
    fetch("/api/organized-items/delete-catalog")
      .then(async (res) => {
        const data = (await res.json()) as DeleteCatalog & { error?: string };
        if (!res.ok) throw new Error(data.error || "Failed");
        setCatalog({
          completedTasks: typeof data.completedTasks === "number" ? data.completedTasks : 0,
          reflections: typeof data.reflections === "number" ? data.reflections : 0,
          shopping: typeof data.shopping === "number" ? data.shopping : 0,
          emptyProjectCount: typeof data.emptyProjectCount === "number" ? data.emptyProjectCount : 0,
        });
      })
      .catch(() => {
        setLoadError(t("settings.deleteAllError"));
      })
      .finally(() => setLoading(false));
  }, [isOpen, t]);

  const suffix = useCallback(
    (n: number) => t("settings.deleteEntriesCountSuffix", { count: n }),
    [t]
  );

  const select = useCallback((key: string, label: string) => {
    setSelectedKey(key);
    setSelectedLabel(label);
    setActionError(null);
  }, []);

  const runDelete = useCallback(async () => {
    if (!selectedKey) {
      setActionError(t("settings.deleteEntriesSelectFirst"));
      return;
    }
    const scope = deleteSelectionKeyToScope(selectedKey);
    if (!scope) {
      setActionError(t("settings.deleteAllError"));
      return;
    }
    setDeleting(true);
    setActionError(null);
    try {
      const dry = await fetch("/api/organized-items/delete-scoped", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true, scope }),
      });
      const dryData = (await dry.json()) as { count?: number; error?: string };
      if (!dry.ok) throw new Error(dryData.error || "Failed");
      const count = dryData.count ?? 0;
      const ok = confirm(
        t("settings.deleteEntriesConfirm", { count, label: selectedLabel })
      );
      if (!ok) {
        setDeleting(false);
        return;
      }
      const del = await fetch("/api/organized-items/delete-scoped", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false, scope }),
      });
      const delData = (await del.json()) as { deleted?: number; error?: string };
      if (!del.ok) throw new Error(delData.error || "Failed");
      window.dispatchEvent(new Event("braindump-reload-items"));
      alert(t("settings.deleteEntriesDone"));
      onClose();
    } catch {
      setActionError(t("settings.deleteAllError"));
    } finally {
      setDeleting(false);
    }
  }, [onClose, selectedKey, selectedLabel, t]);

  const runDeleteAll = useCallback(async () => {
    setDeletingAll(true);
    setActionError(null);
    try {
      const dry = await fetch("/api/organized-items/delete-scoped", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true, scope: { type: "everything" } }),
      });
      const dryData = (await dry.json()) as { count?: number; error?: string };
      if (!dry.ok) throw new Error(dryData.error || "Failed");
      const count = dryData.count ?? 0;
      const ok = confirm(t("settings.deleteEntriesConfirm", { count, label: t("settings.deleteAllEntries") }));
      if (!ok) {
        setDeletingAll(false);
        return;
      }
      const del = await fetch("/api/organized-items/delete-scoped", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false, scope: { type: "everything" } }),
      });
      const delData = (await del.json()) as { deleted?: number; error?: string };
      if (!del.ok) throw new Error(delData.error || "Failed");
      window.dispatchEvent(new Event("braindump-reload-items"));
      alert(t("settings.deleteAllDone"));
      onClose();
    } catch {
      setActionError(t("settings.deleteAllError"));
    } finally {
      setDeletingAll(false);
    }
  }, [onClose, t]);

  const runDeleteEmptyProjects = useCallback(async () => {
    const n = catalog?.emptyProjectCount ?? 0;
    if (n <= 0) return;
    const ok = confirm(t("settings.deleteEmptyProjectsConfirm", { count: n }));
    if (!ok) return;
    setDeletingEmptyProjects(true);
    setActionError(null);
    try {
      const res = await fetch("/api/projects/delete-empty", { method: "POST" });
      const data = (await res.json()) as { deleted?: number; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed");
      window.dispatchEvent(new Event("braindump-reload-items"));
      window.dispatchEvent(new Event("braindump-reload-projects"));
      alert(t("settings.deleteEmptyProjectsDone"));
      const refresh = await fetch("/api/organized-items/delete-catalog");
      const refreshed = (await refresh.json()) as DeleteCatalog & { error?: string };
      if (!refresh.ok) return;
      setCatalog({
        completedTasks: typeof refreshed.completedTasks === "number" ? refreshed.completedTasks : 0,
        reflections: typeof refreshed.reflections === "number" ? refreshed.reflections : 0,
        shopping: typeof refreshed.shopping === "number" ? refreshed.shopping : 0,
        emptyProjectCount: typeof refreshed.emptyProjectCount === "number" ? refreshed.emptyProjectCount : 0,
      });
      const bulkTotal =
        (refreshed.completedTasks ?? 0) + (refreshed.reflections ?? 0) + (refreshed.shopping ?? 0);
      if (bulkTotal === 0 && (refreshed.emptyProjectCount ?? 0) === 0) {
        onClose();
      }
    } catch {
      setActionError(t("settings.deleteAllError"));
    } finally {
      setDeletingEmptyProjects(false);
    }
  }, [catalog, onClose, t]);

  if (!isOpen) return null;

  const rowStyle = (selected: boolean): CSSProperties => ({
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "0.65rem 0.75rem",
    marginBottom: 6,
    borderRadius: 10,
    border: selected ? "2px solid var(--accent)" : "1px solid var(--border-default)",
    background: selected ? "var(--bg-tertiary)" : "var(--bg-secondary)",
    cursor: "pointer",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "var(--text-primary)",
    lineHeight: 1.35,
  });

  const OptionRow = ({
    k,
    label,
    count,
  }: {
    k: string;
    label: string;
    count: number;
  }) => (
    <button
      type="button"
      role="option"
      aria-selected={selectedKey === k}
      onClick={() => select(k, label)}
      style={rowStyle(selectedKey === k)}
    >
      <span style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "baseline" }}>
        <span>{label}</span>
        <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)", flexShrink: 0 }}>
          {suffix(count)}
        </span>
      </span>
    </button>
  );

  const c = catalog;
  const completed = c?.completedTasks ?? 0;
  const refl = c?.reflections ?? 0;
  const shop = c?.shopping ?? 0;
  const hasBulkRows = completed > 0 || refl > 0 || shop > 0;
  const emptyProjCount = c?.emptyProjectCount ?? 0;
  const noBulkAndNoEmptyProjects = !hasBulkRows && emptyProjCount === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bd-delete-entries-title"
      className="bd-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="bd-modal-panel"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--card-radius)",
          maxWidth: "min(520px, 100%)",
          width: "100%",
          maxHeight: "min(90dvh, calc(100dvh - 2rem))",
          boxShadow: "var(--shadow-xl)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <h2 id="bd-delete-entries-title" style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>
            {t("settings.deleteEntriesTitle")}
          </h2>
          <button type="button" onClick={onClose} className="bd-btn" style={{ padding: "0.25rem 0.5rem" }} aria-label={t("settings.deleteEntriesClose")}>
            ×
          </button>
        </div>

        <div style={{ padding: "0 1.25rem", flex: "1 1 auto", minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: "0.75rem 0 0", lineHeight: 1.45 }}>
            {t("settings.deleteEntriesOverlayIntro")}
          </p>

          {loading && (
            <p style={{ marginTop: "1rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>{t("settings.deleteEntriesLoading")}</p>
          )}
          {loadError && (
            <p style={{ marginTop: "1rem", color: "var(--accent)", fontSize: "0.875rem" }}>{loadError}</p>
          )}

          {!loading && !loadError && c && noBulkAndNoEmptyProjects && (
            <p style={{ marginTop: "1rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>{t("settings.deleteEntriesEmpty")}</p>
          )}

          {!loading && !loadError && c && !hasBulkRows && emptyProjCount > 0 && (
            <p style={{ marginTop: "1rem", color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.45 }}>
              {t("settings.deleteEntriesNoEntriesButEmptyProjects")}
            </p>
          )}

          {!loading && !loadError && c && hasBulkRows && (
            <div role="listbox" aria-label={t("settings.deleteEntriesTitle")} style={{ marginTop: "0.75rem", paddingBottom: "0.5rem" }}>
              {completed > 0 && (
                <OptionRow k="completed_tasks" label={t("settings.deleteRowCompletedTasks")} count={completed} />
              )}
              {refl > 0 && <OptionRow k="reflection" label={t("settings.deleteRowReflections")} count={refl} />}
              {shop > 0 && <OptionRow k="shopping" label={t("settings.deleteRowShopping")} count={shop} />}
            </div>
          )}

          {!loading && !loadError && c && emptyProjCount > 0 && (
            <div
              style={{
                marginTop: hasBulkRows ? "1.25rem" : "0.5rem",
                paddingTop: "1rem",
                borderTop: hasBulkRows ? "1px solid var(--border-subtle)" : "none",
              }}
            >
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: "0 0 0.75rem", lineHeight: 1.45 }}>
                {t("settings.deleteEmptyProjectsHint", { count: emptyProjCount })}
              </p>
              <button
                type="button"
                className="bd-btn bd-btn-danger"
                onClick={() => void runDeleteEmptyProjects()}
                disabled={deletingEmptyProjects || deleting || loading || !!loadError}
                style={{ width: "100%", justifyContent: "center" }}
              >
                {deletingEmptyProjects ? t("settings.deleteAllDeleting") : t("settings.deleteEmptyProjectsButton", { count: emptyProjCount })}
              </button>
            </div>
          )}
        </div>

        <div
          style={{
            padding: "0.75rem 1.25rem 1rem",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            flexShrink: 0,
          }}
        >
          {actionError && (
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--accent)" }}>{actionError}</p>
          )}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button type="button" className="bd-btn" onClick={onClose} disabled={deleting || deletingAll || deletingEmptyProjects}>
              {t("settings.deleteEntriesClose")}
            </button>
            <button
              type="button"
              className="bd-btn bd-btn-danger"
              onClick={() => void runDelete()}
              disabled={deleting || deletingAll || deletingEmptyProjects || !selectedKey || loading || !!loadError || !hasBulkRows}
            >
              {deleting ? t("settings.deleteAllDeleting") : t("settings.deleteEntriesSelect")}
            </button>
            {hasBulkRows && (
              <button
                type="button"
                className="bd-btn bd-btn-danger"
                onClick={() => void runDeleteAll()}
                disabled={deleting || deletingAll || deletingEmptyProjects || loading || !!loadError}
              >
                {deletingAll ? t("settings.deleteAllDeleting") : t("settings.deleteAllEntries")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

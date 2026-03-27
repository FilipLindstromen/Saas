"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useI18n } from "@/lib/i18n";

type DeleteCatalog = {
  totals: { all: number; work: number; personal: number };
  completedTasks: { all: number; work: number; personal: number };
  activeTasks: { all: number; work: number; personal: number };
  allTasks: { all: number; work: number; personal: number };
  /** Projects (work/personal) with zero organized items — sidebar shells only. */
  emptyProjectCount: number;
  projects: Array<{ id: string; name: string; domain: string; count: number }>;
  workCategories: Array<{ category: string; count: number }>;
  personalCategories: Array<{ category: string; count: number }>;
  itemTypesWork: Record<string, number>;
  itemTypesPersonal: Record<string, number>;
};

function formatCategoryLabel(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function itemTypeDisplay(itemType: string, t: (key: string) => string): string {
  if (itemType === "task_completed") return t("items.typeTaskCompleted");
  return (itemType || "note").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Maps UI selection key → POST body `scope` for /api/organized-items/delete-scoped */
function deleteSelectionKeyToScope(key: string): object | null {
  if (key === "everything") return { type: "everything" };
  const parts = key.split("|");
  const h = parts[0];
  if (h === "domain" && (parts[1] === "work" || parts[1] === "personal")) {
    return { type: "domain", domain: parts[1] };
  }
  if (h === "completed") {
    if (parts[1] === "all") return { type: "completed_tasks" };
    if (parts[1] === "work" || parts[1] === "personal") {
      return { type: "completed_tasks", domain: parts[1] };
    }
  }
  if (h === "active") {
    if (parts[1] === "all") return { type: "active_tasks" };
    if (parts[1] === "work" || parts[1] === "personal") {
      return { type: "active_tasks", domain: parts[1] };
    }
  }
  if (h === "alltasks") {
    if (parts[1] === "all") return { type: "all_tasks" };
    if (parts[1] === "work" || parts[1] === "personal") {
      return { type: "all_tasks", domain: parts[1] };
    }
  }
  if (h === "itype" && parts.length >= 3) {
    const domain = parts[1];
    const itemType = parts.slice(2).join("|");
    if ((domain === "work" || domain === "personal") && itemType) {
      return { type: "item_type", itemType, domain };
    }
  }
  if (h === "wcat" && parts[1]) {
    try {
      const category = decodeURIComponent(parts[1]);
      if (category) return { type: "work_category", category };
    } catch {
      return null;
    }
  }
  if (h === "pcat" && parts[1]) {
    try {
      const category = decodeURIComponent(parts[1]);
      if (category) return { type: "personal_category", category };
    } catch {
      return null;
    }
  }
  if (h === "project" && parts[1]) {
    return { type: "project", projectId: parts[1] };
  }
  return null;
}

interface DeleteEntriesOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

function sectionTitleStyle(): React.CSSProperties {
  return {
    fontSize: "0.6875rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--text-tertiary)",
    margin: "1.25rem 0 0.5rem",
    paddingTop: "0.25rem",
    borderTop: "1px solid var(--border-subtle)",
  };
}

function firstSectionTitleStyle(): CSSProperties {
  return {
    fontSize: "0.6875rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--text-tertiary)",
    margin: "0 0 0.5rem",
  };
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
          ...data,
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
        ...refreshed,
        emptyProjectCount: typeof refreshed.emptyProjectCount === "number" ? refreshed.emptyProjectCount : 0,
      });
      if ((refreshed.totals?.all ?? 0) === 0 && (refreshed.emptyProjectCount ?? 0) === 0) {
        onClose();
      }
    } catch {
      setActionError(t("settings.deleteAllError"));
    } finally {
      setDeletingEmptyProjects(false);
    }
  }, [catalog, onClose, t]);

  if (!isOpen) return null;

  const workLabel = t("mode.work");
  const personalLabel = t("mode.personal");

  const subgroupLabelStyle: CSSProperties = {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "var(--text-secondary)",
    margin: "0.65rem 0 0.35rem",
  };

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
    danger,
  }: {
    k: string;
    label: string;
    count: number;
    danger?: boolean;
  }) => (
    <button
      type="button"
      role="option"
      aria-selected={selectedKey === k}
      onClick={() => select(k, label)}
      style={{
        ...rowStyle(selectedKey === k),
        ...(danger
          ? {
              borderColor:
                selectedKey === k ? "var(--accent)" : "color-mix(in srgb, var(--accent) 35%, var(--border-default))",
            }
          : {}),
      }}
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
  const emptyEntries = Boolean(c && c.totals.all === 0);
  const emptyProjCount = c?.emptyProjectCount ?? 0;

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

          {!loading && !loadError && c && emptyEntries && emptyProjCount === 0 && (
            <p style={{ marginTop: "1rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>{t("settings.deleteEntriesEmpty")}</p>
          )}

          {!loading && !loadError && c && emptyEntries && emptyProjCount > 0 && (
            <p style={{ marginTop: "1rem", color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.45 }}>
              {t("settings.deleteEntriesNoEntriesButEmptyProjects")}
            </p>
          )}

          {!loading && !loadError && c && !emptyEntries && (
            <div role="listbox" aria-label={t("settings.deleteEntriesTitle")} style={{ paddingBottom: "0.5rem" }}>
              <h3 style={firstSectionTitleStyle()}>{t("settings.deleteSectionWorkspace")}</h3>
              {c.totals.all > 0 && (
                <OptionRow
                  k="everything"
                  label={t("settings.deleteRowEverything")}
                  count={c.totals.all}
                  danger
                />
              )}
              {c.totals.work > 0 && (
                <OptionRow
                  k="domain|work"
                  label={t("settings.deleteRowAllInDomain", { domain: workLabel })}
                  count={c.totals.work}
                  danger
                />
              )}
              {c.totals.personal > 0 && (
                <OptionRow
                  k="domain|personal"
                  label={t("settings.deleteRowAllInDomain", { domain: personalLabel })}
                  count={c.totals.personal}
                  danger
                />
              )}

              {(c.completedTasks.all > 0 ||
                c.completedTasks.work > 0 ||
                c.completedTasks.personal > 0 ||
                c.activeTasks.all > 0 ||
                c.activeTasks.work > 0 ||
                c.activeTasks.personal > 0 ||
                c.allTasks.all > 0 ||
                c.allTasks.work > 0 ||
                c.allTasks.personal > 0) && (
                <>
                  <h3 style={sectionTitleStyle()}>{t("settings.deleteSectionTasks")}</h3>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", margin: "-0.25rem 0 0.5rem", lineHeight: 1.4 }}>
                    {t("settings.deleteEntriesTasksHint")}
                  </p>
                  {(c.completedTasks.all > 0 || c.completedTasks.work > 0 || c.completedTasks.personal > 0) && (
                    <>
                      <div style={subgroupLabelStyle}>{t("settings.deleteTasksSubgroupCompleted")}</div>
                      {c.completedTasks.all > 0 && (
                        <OptionRow
                          k="completed|all"
                          label={t("settings.deleteRowCompletedAll")}
                          count={c.completedTasks.all}
                        />
                      )}
                      {c.completedTasks.work > 0 && (
                        <OptionRow
                          k="completed|work"
                          label={t("settings.deleteRowCompletedInDomain", { domain: workLabel })}
                          count={c.completedTasks.work}
                        />
                      )}
                      {c.completedTasks.personal > 0 && (
                        <OptionRow
                          k="completed|personal"
                          label={t("settings.deleteRowCompletedInDomain", { domain: personalLabel })}
                          count={c.completedTasks.personal}
                        />
                      )}
                    </>
                  )}
                  {(c.activeTasks.all > 0 || c.activeTasks.work > 0 || c.activeTasks.personal > 0) && (
                    <>
                      <div style={subgroupLabelStyle}>{t("settings.deleteTasksSubgroupActive")}</div>
                      {c.activeTasks.all > 0 && (
                        <OptionRow k="active|all" label={t("settings.deleteRowActiveAll")} count={c.activeTasks.all} />
                      )}
                      {c.activeTasks.work > 0 && (
                        <OptionRow
                          k="active|work"
                          label={t("settings.deleteRowActiveInDomain", { domain: workLabel })}
                          count={c.activeTasks.work}
                        />
                      )}
                      {c.activeTasks.personal > 0 && (
                        <OptionRow
                          k="active|personal"
                          label={t("settings.deleteRowActiveInDomain", { domain: personalLabel })}
                          count={c.activeTasks.personal}
                        />
                      )}
                    </>
                  )}
                  {(c.allTasks.all > 0 || c.allTasks.work > 0 || c.allTasks.personal > 0) && (
                    <>
                      <div style={subgroupLabelStyle}>{t("settings.deleteTasksSubgroupAllStates")}</div>
                      {c.allTasks.all > 0 && (
                        <OptionRow k="alltasks|all" label={t("settings.deleteRowAllTasksAll")} count={c.allTasks.all} />
                      )}
                      {c.allTasks.work > 0 && (
                        <OptionRow
                          k="alltasks|work"
                          label={t("settings.deleteRowAllTasksInDomain", { domain: workLabel })}
                          count={c.allTasks.work}
                        />
                      )}
                      {c.allTasks.personal > 0 && (
                        <OptionRow
                          k="alltasks|personal"
                          label={t("settings.deleteRowAllTasksInDomain", { domain: personalLabel })}
                          count={c.allTasks.personal}
                        />
                      )}
                    </>
                  )}
                </>
              )}

              {Object.entries(c.itemTypesWork).filter(([, n]) => n > 0).length > 0 && (
                <>
                  <h3 style={sectionTitleStyle()}>{t("settings.deleteSectionByTypeWork")}</h3>
                  {Object.entries(c.itemTypesWork)
                    .filter(([, n]) => n > 0)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([itemType, count]) => (
                      <OptionRow
                        key={`iw-${itemType}`}
                        k={`itype|work|${itemType}`}
                        label={t("settings.deleteRowItemType", {
                          type: itemTypeDisplay(itemType, t),
                          domain: workLabel,
                        })}
                        count={count}
                      />
                    ))}
                </>
              )}

              {Object.entries(c.itemTypesPersonal).filter(([, n]) => n > 0).length > 0 && (
                <>
                  <h3 style={sectionTitleStyle()}>{t("settings.deleteSectionByTypePersonal")}</h3>
                  {Object.entries(c.itemTypesPersonal)
                    .filter(([, n]) => n > 0)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([itemType, count]) => (
                      <OptionRow
                        key={`ip-${itemType}`}
                        k={`itype|personal|${itemType}`}
                        label={t("settings.deleteRowItemType", {
                          type: itemTypeDisplay(itemType, t),
                          domain: personalLabel,
                        })}
                        count={count}
                      />
                    ))}
                </>
              )}

              {c.workCategories.filter((x) => x.count > 0).length > 0 && (
                <>
                  <h3 style={sectionTitleStyle()}>{t("settings.deleteSectionWorkAreas")}</h3>
                  {c.workCategories
                    .filter((x) => x.count > 0)
                    .sort((a, b) => a.category.localeCompare(b.category))
                    .map(({ category, count }) => (
                      <OptionRow
                        key={`w-${category}`}
                        k={`wcat|${encodeURIComponent(category)}`}
                        label={t("settings.deleteRowWorkArea", { name: formatCategoryLabel(category) })}
                        count={count}
                      />
                    ))}
                </>
              )}

              {c.personalCategories.filter((x) => x.count > 0).length > 0 && (
                <>
                  <h3 style={sectionTitleStyle()}>{t("settings.deleteSectionPersonalAreas")}</h3>
                  {c.personalCategories
                    .filter((x) => x.count > 0)
                    .sort((a, b) => a.category.localeCompare(b.category))
                    .map(({ category, count }) => (
                      <OptionRow
                        key={`p-${category}`}
                        k={`pcat|${encodeURIComponent(category)}`}
                        label={t("settings.deleteRowPersonalArea", { name: formatCategoryLabel(category) })}
                        count={count}
                      />
                    ))}
                </>
              )}

              {c.projects.length > 0 && (
                <>
                  <h3 style={sectionTitleStyle()}>{t("settings.deleteSectionProjects")}</h3>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", margin: "-0.25rem 0 0.5rem", lineHeight: 1.4 }}>
                    {t("settings.deleteProjectKeepsSidebar")}
                  </p>
                  {c.projects.map((p) => (
                    <OptionRow
                      key={p.id}
                      k={`project|${p.id}`}
                      label={t("settings.deleteRowProject", { name: p.name })}
                      count={p.count}
                    />
                  ))}
                </>
              )}
            </div>
          )}

          {!loading && !loadError && c && emptyProjCount > 0 && (
            <div
              style={{
                marginTop: !emptyEntries ? "1.25rem" : "0.5rem",
                paddingTop: "1rem",
                borderTop: emptyEntries ? "none" : "1px solid var(--border-subtle)",
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
            <button type="button" className="bd-btn" onClick={onClose} disabled={deleting || deletingEmptyProjects}>
              {t("settings.deleteEntriesClose")}
            </button>
            <button
              type="button"
              className="bd-btn bd-btn-danger"
              onClick={() => void runDelete()}
              disabled={deleting || deletingEmptyProjects || !selectedKey || loading || !!loadError || emptyEntries}
            >
              {deleting ? t("settings.deleteAllDeleting") : t("settings.deleteEntriesSelect")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n";
import { playTaskCompleteCheer } from "@/lib/task-complete-sound";
import { BRAINDUMP_NEW_BATCH_EVENT, getLastNewBatchIds } from "@/lib/newBatch";
import { isContentRedundantWithTitle } from "@/lib/entry-content-redundant";
import {
  getPersonalAreasList,
  PERSONAL_AREA_DEFAULTS,
  formatAreaLabel,
} from "@/lib/personal-areas";
import { mergeEntryTypesForDomain, type ItemContextSubmenu } from "@/components/ItemsViewArea";

interface SavedItem {
  id: string;
  domain: string;
  category: string;
  subcategory: string;
  itemType: string;
  title: string;
  content: string;
  status: string;
  progress?: string;
  kanbanColumn?: string | null;
  recommendedView: string;
  reminderAt?: string | null;
  reminderMinutesBefore?: number | null;
  project?: { id: string; name: string } | null;
  tags?: { tag: { name: string } }[];
}

interface SavedItemsListProps {
  mode: string;
  projectId: string | null;
  category: string | null;
  itemType: string | null;
}

function isTaskRow(it: Pick<SavedItem, "itemType">): boolean {
  return it.itemType === "task" || it.itemType === "task_completed";
}

function isTaskCompleted(it: Pick<SavedItem, "itemType" | "progress" | "kanbanColumn">): boolean {
  return (
    it.itemType === "task_completed" ||
    (it.itemType === "task" && (it.progress === "completed" || it.kanbanColumn === "completed"))
  );
}

function entryTypeLabel(itemType: string, t?: (key: string) => string): string {
  if (itemType === "task_completed") return t ? t("items.typeTaskCompleted") : "Task: Completed";
  return (itemType || "note").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function SavedItemsList({ mode, projectId, category, itemType }: SavedItemsListProps) {
  const { t } = useI18n();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [newBatchTick, setNewBatchTick] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onNewBatch = () => setNewBatchTick((n) => n + 1);
    window.addEventListener(BRAINDUMP_NEW_BATCH_EVENT, onNewBatch);
    return () => window.removeEventListener(BRAINDUMP_NEW_BATCH_EVENT, onNewBatch);
  }, []);

  const fetchItems = useCallback(() => {
    const params = new URLSearchParams();
    params.set("domain", mode);
    if (projectId) params.set("projectId", projectId);
    if (category) params.set("category", category);
    if (itemType && itemType !== "new") params.set("itemType", itemType);
    setLoading(true);
    fetch(`/api/organized-items?${params}`)
      .then((r) => r.json())
      .then((d) => {
        let list: SavedItem[] = d.items || [];
        if (itemType === "new") {
          const ids = getLastNewBatchIds();
          list = list.filter((it) => ids.has(it.id));
        }
        setItems(list);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [mode, projectId, category, itemType, newBatchTick]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    const onReload = () => fetchItems();
    window.addEventListener("braindump-reload-items", onReload);
    return () => window.removeEventListener("braindump-reload-items", onReload);
  }, [fetchItems]);

  const setTaskCompleted = useCallback((id: string, completed: boolean) => {
    const itemType = completed ? "task_completed" : "task";
    const progress = completed ? "completed" : "todo";
    const kanbanColumn = completed ? "completed" : "todo";
    fetch(`/api/organized-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemType, progress, kanbanColumn }),
    })
      .then((r) => {
        if (r.ok) {
          setItems((prev) =>
            prev.map((it) => (it.id === id ? { ...it, itemType, progress, kanbanColumn } : it))
          );
          if (completed) playTaskCompleteCheer();
        }
      })
      .catch(() => {});
  }, []);

  const deleteItem = useCallback((id: string, skipConfirm?: boolean) => {
    if (!skipConfirm && !confirm("Delete this item?")) return;
    fetch(`/api/organized-items/${id}`, { method: "DELETE" })
      .then((r) => {
        if (r.ok) setItems((prev) => prev.filter((it) => it.id !== id));
      })
      .catch(() => {});
  }, []);

  const updateItemType = useCallback((id: string, newType: string) => {
    const patch: Record<string, unknown> = { itemType: newType };
    if (newType === "task_completed") {
      patch.progress = "completed";
      patch.kanbanColumn = "completed";
    } else if (newType === "task") {
      patch.progress = "todo";
      patch.kanbanColumn = "todo";
    }
    fetch(`/api/organized-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
      .then((r) => {
        if (r.ok) {
          setItems((prev) =>
            prev.map((it) => {
              if (it.id !== id) return it;
              const next = { ...it, itemType: newType };
              if (newType === "task_completed") return { ...next, progress: "completed", kanbanColumn: "completed" };
              if (newType === "task") return { ...next, progress: "todo", kanbanColumn: "todo" };
              return next;
            })
          );
          if (newType === "task_completed") playTaskCompleteCheer();
        }
      })
      .catch(() => {});
  }, []);

  const [projectsList, setProjectsList] = useState<{ id: string; name: string }[]>([]);

  const loadWorkProjects = useCallback(() => {
    fetch("/api/projects?domain=work")
      .then((r) => r.json())
      .then((d) =>
        setProjectsList((d.projects ?? []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
      )
      .catch(() => setProjectsList([]));
  }, []);

  useEffect(() => {
    loadWorkProjects();
  }, [loadWorkProjects]);

  useEffect(() => {
    window.addEventListener("braindump-reload-projects", loadWorkProjects);
    return () => window.removeEventListener("braindump-reload-projects", loadWorkProjects);
  }, [loadWorkProjects]);

  const updateProject = useCallback((id: string, projectIdVal: string | null) => {
    fetch(`/api/organized-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: projectIdVal }),
    })
      .then((r) => {
        if (r.ok) {
          const project = projectIdVal ? projectsList.find((p) => p.id === projectIdVal) ?? null : null;
          setItems((prev) =>
            prev.map((it) => (it.id === id ? { ...it, project: project ? { id: project.id, name: project.name } : null } : it))
          );
        }
      })
      .catch(() => {});
  }, [projectsList]);

  const updateCategory = useCallback((id: string, cat: string) => {
    fetch(`/api/organized-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: cat, subcategory: "" }),
    })
      .then((r) => {
        if (r.ok) setItems((prev) => prev.map((it) => (it.id === id ? { ...it, category: cat, subcategory: "" } : it)));
      })
      .catch(() => {});
  }, []);

  const updateItemDomain = useCallback(
    (id: string, newDomain: "work" | "personal") => {
      const it = items.find((i) => i.id === id);
      if (!it || (it.domain !== "work" && it.domain !== "personal") || it.domain === newDomain) return;
      const body =
        newDomain === "work"
          ? { domain: "work", category: "tasks", subcategory: "", projectId: null as string | null }
          : {
              domain: "personal",
              category: PERSONAL_AREA_DEFAULTS[0] ?? "thoughts",
              subcategory: "",
              projectId: null as string | null,
            };
      fetch(`/api/organized-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then((r) => {
          if (r.ok) void fetchItems();
        })
        .catch(() => {});
    },
    [items, fetchItems]
  );

  const updateEntryContent = useCallback((id: string, updates: { title?: string; content?: string }) => {
    fetch(`/api/organized-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
      .then((r) => {
        if (r.ok) setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...updates } : it)));
      })
      .catch(() => {});
  }, []);

  const REMINDER_MINUTES_OPTIONS = [0, 5, 10, 15, 30, 60] as const;
  const updateReminder = useCallback(
    (id: string, reminderDate: string, reminderTime: string, reminderMinutesBefore: number) => {
      const clearReminder = !reminderDate.trim();
      const payload = clearReminder
        ? { reminderAt: null, reminderMinutesBefore: null, reminderNotifiedAt: null, reminderEarlyNotifiedAt: null }
        : {
            reminderAt: new Date(reminderDate + "T" + (reminderTime || "00:00") + ":00").toISOString(),
            reminderMinutesBefore: reminderMinutesBefore || 0,
            reminderNotifiedAt: null,
            reminderEarlyNotifiedAt: null,
          };
      fetch(`/api/organized-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((r) => {
          if (r.ok)
            setItems((prev) =>
              prev.map((it) =>
                it.id === id
                  ? {
                      ...it,
                      reminderAt: clearReminder ? undefined : payload.reminderAt,
                      reminderMinutesBefore: clearReminder ? undefined : payload.reminderMinutesBefore,
                    }
                  : it
              )
            );
        })
        .catch(() => {});
    },
    []
  );

  const [itemContextMenu, setItemContextMenu] = useState<{ id: string; x: number; y: number; domain: string; currentType: string } | null>(null);
  const [itemContextSubmenu, setItemContextSubmenu] = useState<ItemContextSubmenu | null>(null);
  const [editingEntry, setEditingEntry] = useState<{ id: string; title: string; content: string } | null>(null);
  const editingEntryRef = useRef(editingEntry);
  editingEntryRef.current = editingEntry;
  const [reminderEntry, setReminderEntry] = useState<{
    id: string;
    title: string;
    reminderDate: string;
    reminderTime: string;
    reminderMinutesBefore: number;
  } | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setIsMobile(window.matchMedia("(max-width: 768px)").matches);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const [editEntryPortalEl, setEditEntryPortalEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setEditEntryPortalEl(typeof document !== "undefined" ? document.body : null);
  }, []);

  useEffect(() => {
    if (!editingEntry) return;
    const onChromePointerDown = (e: PointerEvent) => {
      const node = e.target;
      if (!(node instanceof Node)) return;
      const top = document.querySelector(".bd-topbar");
      const bottom = document.querySelector(".bd-bottom-bar");
      if (!(top?.contains(node) || bottom?.contains(node))) return;
      const ed = editingEntryRef.current;
      if (!ed) return;
      updateEntryContent(ed.id, { title: ed.title, content: ed.content });
      setEditingEntry(null);
    };
    document.addEventListener("pointerdown", onChromePointerDown, true);
    return () => document.removeEventListener("pointerdown", onChromePointerDown, true);
  }, [editingEntry, updateEntryContent]);

  useEffect(() => {
    if (!itemContextMenu) return;
    setItemContextSubmenu(null);
  }, [itemContextMenu?.id]);

  useEffect(() => {
    if (!itemContextMenu) return;
    if (isMobile) return;
    const close = () => {
      setItemContextMenu(null);
      setItemContextSubmenu(null);
    };
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [itemContextMenu, isMobile]);

  if (loading) {
    return (
      <div className="bd-panel" style={{ padding: "1.5rem" }}>
        <p className="bd-empty">{t("items.loading")}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bd-panel" style={{ padding: "1.5rem" }}>
        <p className="bd-empty">{t("saved.empty")}</p>
      </div>
    );
  }

  return (
    <div className="bd-panel" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
        {t("saved.title")}
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", overflow: "auto" }}>
        {items.map((it) => (
          <div
            key={it.id}
            onDoubleClick={() => setEditingEntry({ id: it.id, title: it.title, content: it.content ?? "" })}
            onContextMenu={(e) => {
              e.preventDefault();
              setItemContextMenu({ id: it.id, x: e.clientX, y: e.clientY, domain: it.domain, currentType: it.itemType });
            }}
            style={{
              padding: "0.75rem",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--button-radius)",
              background: "var(--bg-tertiary)",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{it.title}</div>
                {!(it.content?.trim() && isContentRedundantWithTitle(it.title, it.content)) && (
                <div
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--text-secondary)",
                    marginTop: "0.25rem",
                    lineHeight: 1.4,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {it.content?.trim() ? (it.content.length > 160 ? `${it.content.slice(0, 160)}…` : it.content) : "—"}
                </div>
                )}
                <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: "0.25rem" }}>
                  {entryTypeLabel(it.itemType, t)}
                  {it.category && ` · ${it.category}`}
                  {it.project && ` · ${it.project.name}`}
                </div>
              </div>
              {isTaskRow(it) && (
                <div style={{ flexShrink: 0, display: "flex", alignItems: "flex-start", paddingTop: "0.15rem" }}>
                  <input
                    type="checkbox"
                    checked={isTaskCompleted(it)}
                    onChange={(e) => {
                      e.stopPropagation();
                      setTaskCompleted(it.id, e.target.checked);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={isTaskCompleted(it) ? t("items.taskToggleOpen") : t("items.taskToggleDone")}
                    style={{ width: 18, height: 18, accentColor: "var(--accent, #ea580c)", cursor: "pointer" }}
                  />
                </div>
              )}
              <button
                type="button"
                className="bd-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setItemContextMenu({ id: it.id, x: e.clientX, y: e.clientY, domain: it.domain, currentType: it.itemType });
                }}
                aria-label="More actions"
                style={{ minWidth: 32, padding: "0.2rem 0.45rem", lineHeight: 1 }}
              >
                ⋮
              </button>
            </div>
          </div>
        ))}
      </div>

      {itemContextMenu && (() => {
        const selectedItem = items.find((i) => i.id === itemContextMenu.id);
        const domainKey = selectedItem?.domain ?? itemContextMenu.domain;
        const types = mergeEntryTypesForDomain(domainKey, items, [], t);
        const personalAreas = getPersonalAreasList(items);
        const closeMenu = () => {
          setItemContextMenu(null);
          setItemContextSubmenu(null);
        };
        const placementIsWork = domainKey === "work";
        const placementIsPersonal = domainKey === "personal";
        const showDomainAndPlacement = placementIsWork || placementIsPersonal;

        const subFlyoutStyle: CSSProperties = {
          position: "fixed",
          left: itemContextMenu.x + 168,
          top: itemContextMenu.y,
          zIndex: "calc(var(--bd-z-dropdown) + 1)",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: "12px",
          boxShadow: "var(--shadow-md)",
          padding: "0.25rem 0",
          minWidth: "188px",
          maxHeight: "min(320px, 70dvh)",
          overflow: "auto",
        };

        const submenuHeader = (label: string) => (
          <div
            style={{
              padding: "0.25rem 0.5rem",
              fontSize: "0.7rem",
              fontWeight: 600,
              color: "var(--text-tertiary)",
              borderBottom: "1px solid var(--border-default)",
            }}
          >
            {label}
          </div>
        );

        const workPrivateOptions = () => (
          <>
            <button
              type="button"
              className="bd-btn"
              style={{ width: "100%", justifyContent: "flex-start", fontWeight: domainKey === "work" ? 600 : 400 }}
              onClick={() => {
                updateItemDomain(itemContextMenu.id, "work");
                closeMenu();
              }}
            >
              {t("mode.work")}
              {domainKey === "work" ? " ✓" : ""}
            </button>
            <button
              type="button"
              className="bd-btn"
              style={{ width: "100%", justifyContent: "flex-start", fontWeight: domainKey === "personal" ? 600 : 400 }}
              onClick={() => {
                updateItemDomain(itemContextMenu.id, "personal");
                closeMenu();
              }}
            >
              {t("mode.personal")}
              {domainKey === "personal" ? " ✓" : ""}
            </button>
          </>
        );

        const projectPickList = () => {
          const currentProjectId = selectedItem?.project?.id ?? null;
          return (
            <>
              <button
                type="button"
                className="bd-btn"
                style={{ width: "100%", justifyContent: "flex-start", fontWeight: currentProjectId === null ? 600 : 400 }}
                onClick={() => {
                  updateProject(itemContextMenu.id, null);
                  closeMenu();
                }}
              >
                {t("menu.noProject")}
                {currentProjectId === null ? " ✓" : ""}
              </button>
              {projectsList.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="bd-btn"
                  style={{ width: "100%", justifyContent: "flex-start", fontWeight: currentProjectId === p.id ? 600 : 400 }}
                  onClick={() => {
                    updateProject(itemContextMenu.id, p.id);
                    closeMenu();
                  }}
                >
                  {p.name}
                  {currentProjectId === p.id ? " ✓" : ""}
                </button>
              ))}
            </>
          );
        };

        const areaPickList = () => {
          const currentCategory = selectedItem?.category ?? "";
          return (
            <>
              {personalAreas.map((areaKey) => (
                <button
                  key={areaKey}
                  type="button"
                  className="bd-btn"
                  style={{ width: "100%", justifyContent: "flex-start", fontWeight: currentCategory === areaKey ? 600 : 400 }}
                  onClick={() => {
                    updateCategory(itemContextMenu.id, areaKey);
                    closeMenu();
                  }}
                >
                  {formatAreaLabel(areaKey)}
                  {currentCategory === areaKey ? " ✓" : ""}
                </button>
              ))}
            </>
          );
        };

        const typeOptionList = () => (
          <>
            {types.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className="bd-btn"
                style={{
                  width: "100%",
                  justifyContent: "flex-start",
                  fontWeight: itemContextMenu.currentType === value ? 600 : 400,
                }}
                onClick={() => {
                  updateItemType(itemContextMenu.id, value);
                  closeMenu();
                }}
              >
                {label}
                {itemContextMenu.currentType === value ? " ✓" : ""}
              </button>
            ))}
          </>
        );

        const mobileSubTitle =
          itemContextSubmenu === "workPrivate"
            ? t("menu.changeWorkPrivate")
            : itemContextSubmenu === "areaProject"
              ? placementIsWork
                ? t("menu.selectProject")
                : t("menu.selectArea")
              : itemContextSubmenu === "type"
                ? t("menu.changeType")
                : "";

        return (
          <div
            style={
              isMobile
                ? {
                    position: "fixed",
                    inset: 0,
                    zIndex: "var(--bd-z-dropdown)",
                    background: "rgba(0,0,0,0.35)",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    padding: "0.75rem",
                  }
                : undefined
            }
            onClick={isMobile ? closeMenu : undefined}
          >
            <div
              style={{
                position: isMobile ? "relative" : "fixed",
                left: isMobile ? undefined : itemContextMenu.x,
                top: isMobile ? undefined : itemContextMenu.y,
                zIndex: "var(--bd-z-dropdown)",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                borderRadius: isMobile ? "16px" : "12px",
                boxShadow: "var(--shadow-md)",
                padding: "0.25rem 0",
                minWidth: "168px",
                width: isMobile ? "min(100%, 420px)" : undefined,
                maxHeight: isMobile ? "80dvh" : undefined,
                overflow: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {isMobile && itemContextSubmenu ? (
                <>
                  <button
                    type="button"
                    className="bd-btn"
                    style={{ width: "100%", justifyContent: "flex-start", fontWeight: 600 }}
                    onClick={() => setItemContextSubmenu(null)}
                  >
                    {t("menu.back")}
                  </button>
                  <div
                    style={{
                      padding: "0.25rem 0.5rem",
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      color: "var(--text-tertiary)",
                      borderBottom: "1px solid var(--border-default)",
                    }}
                  >
                    {mobileSubTitle}
                  </div>
                  {itemContextSubmenu === "workPrivate" ? workPrivateOptions() : null}
                  {itemContextSubmenu === "areaProject"
                    ? placementIsWork
                      ? projectPickList()
                      : placementIsPersonal
                        ? areaPickList()
                        : null
                    : null}
                  {itemContextSubmenu === "type" ? typeOptionList() : null}
                </>
              ) : (
                <>
                  <div
                    style={{
                      padding: "0.25rem 0.5rem",
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      color: "var(--text-tertiary)",
                      borderBottom: "1px solid var(--border-default)",
                    }}
                  >
                    {t("menu.actions")}
                  </div>
                  <button
                    type="button"
                    className="bd-btn"
                    style={{ width: "100%", justifyContent: "flex-start" }}
                    onClick={() => {
                      const it = items.find((i) => i.id === itemContextMenu.id);
                      if (it) setEditingEntry({ id: it.id, title: it.title, content: it.content ?? "" });
                      closeMenu();
                    }}
                  >
                    {t("menu.edit")}
                  </button>
                  {showDomainAndPlacement ? (
                    <button
                      type="button"
                      className="bd-btn"
                      style={{ width: "100%", justifyContent: "flex-start" }}
                      onClick={() => setItemContextSubmenu("workPrivate")}
                    >
                      {t("menu.changeWorkPrivate")}
                    </button>
                  ) : null}
                  {showDomainAndPlacement ? (
                    <button
                      type="button"
                      className="bd-btn"
                      style={{ width: "100%", justifyContent: "flex-start" }}
                      onClick={() => setItemContextSubmenu("areaProject")}
                    >
                      {t("menu.changeAreaProject")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="bd-btn"
                    style={{ width: "100%", justifyContent: "flex-start" }}
                    onClick={() => setItemContextSubmenu("type")}
                  >
                    {t("menu.changeType")}
                  </button>
                  <div style={{ borderTop: "1px solid var(--border-default)", marginTop: "0.25rem", paddingTop: "0.25rem" }}>
                    <button
                      type="button"
                      className="bd-btn"
                      style={{ width: "100%", justifyContent: "flex-start", color: "var(--text-danger, #c53030)" }}
                      onClick={() => {
                        deleteItem(itemContextMenu.id, true);
                        closeMenu();
                      }}
                    >
                      {t("menu.delete")}
                    </button>
                  </div>
                  {isMobile ? (
                    <div style={{ borderTop: "1px solid var(--border-default)", marginTop: "0.25rem", paddingTop: "0.25rem" }}>
                      <button type="button" className="bd-btn" style={{ width: "100%" }} onClick={closeMenu}>
                        {t("menu.cancel")}
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
            {!isMobile && itemContextSubmenu ? (
              <div style={subFlyoutStyle} onClick={(e) => e.stopPropagation()}>
                {itemContextSubmenu === "workPrivate" ? (
                  <>
                    {submenuHeader(t("menu.changeWorkPrivate"))}
                    {workPrivateOptions()}
                  </>
                ) : null}
                {itemContextSubmenu === "areaProject" ? (
                  <>
                    {submenuHeader(placementIsWork ? t("menu.selectProject") : t("menu.selectArea"))}
                    {placementIsWork ? projectPickList() : placementIsPersonal ? areaPickList() : null}
                  </>
                ) : null}
                {itemContextSubmenu === "type" ? (
                  <>
                    {submenuHeader(t("menu.changeType"))}
                    {typeOptionList()}
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })()}

      {editingEntry && editEntryPortalEl
        ? createPortal(
            <div
              className="bd-modal-backdrop bd-edit-entry-backdrop"
              onClick={() => setEditingEntry(null)}
            >
              <div
                className={`bd-panel bd-modal-panel bd-edit-entry-panel${isMobile ? "" : " bd-edit-entry-panel--tall"}`}
                style={{
                  padding: isMobile ? "1rem 1rem 1.1rem" : "1.25rem",
                  maxWidth: isMobile ? "100%" : 560,
                  width: "100%",
                  boxSizing: "border-box",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bd-edit-entry-panel-title-row">
                  <h3>{t("items.editEntry")}</h3>
                  <button
                    type="button"
                    className="bd-btn bd-btn-primary bd-edit-entry-save-header-btn"
                    aria-label={t("items.ariaSaveEntry")}
                    title={t("items.ariaSaveEntry")}
                    onClick={() => {
                      if (!editingEntry) return;
                      updateEntryContent(editingEntry.id, { title: editingEntry.title, content: editingEntry.content });
                      setEditingEntry(null);
                    }}
                  >
                    {t("scope.save")}
                  </button>
                </div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem" }}>{t("items.headline")}</label>
            <input
              className="bd-input"
              value={editingEntry.title}
              onChange={(e) => setEditingEntry((prev) => prev && { ...prev, title: e.target.value })}
              placeholder={t("items.titlePlaceholder")}
              style={{ width: "100%", marginBottom: "0.75rem", boxSizing: "border-box" }}
              autoFocus
            />
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem" }}>{t("items.description")}</label>
            <textarea
              className="bd-textarea"
              value={editingEntry.content}
              onChange={(e) => setEditingEntry((prev) => prev && { ...prev, content: e.target.value })}
              placeholder={t("items.descPlaceholder")}
              style={{
                width: "100%",
                minHeight: 120,
                marginBottom: "1rem",
                borderRadius: 18,
                boxSizing: "border-box",
              }}
            />
            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                alignItems: isMobile ? "stretch" : "center",
                justifyContent: "space-between",
                gap: isMobile ? "0.75rem" : "0.5rem",
                flexWrap: isMobile ? "nowrap" : "wrap",
                paddingTop: isMobile ? "0.25rem" : undefined,
              }}
            >
              <button
                type="button"
                className="bd-btn bd-btn-danger"
                onClick={() => {
                  if (!confirm(t("items.confirmDeleteEntry"))) return;
                  deleteItem(editingEntry.id, true);
                  setEditingEntry(null);
                }}
                aria-label={t("items.ariaDeleteEntry")}
                title={t("items.ariaDeleteEntry")}
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  padding: "0.55rem",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  alignSelf: isMobile ? "flex-start" : undefined,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </button>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  marginLeft: isMobile ? 0 : "auto",
                  justifyContent: isMobile ? "flex-end" : undefined,
                  width: isMobile ? "100%" : undefined,
                }}
              >
                <button
                  type="button"
                  className="bd-btn"
                  onClick={() => setEditingEntry(null)}
                  aria-label={t("items.ariaCancelEdit")}
                  title={t("items.ariaCancelEdit")}
                  style={{ minWidth: 44, minHeight: 44, padding: "0.55rem", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="bd-btn bd-btn-primary"
                  onClick={() => {
                    updateEntryContent(editingEntry.id, { title: editingEntry.title, content: editingEntry.content });
                    setEditingEntry(null);
                  }}
                  aria-label={t("items.ariaSaveEntry")}
                  title={t("items.ariaSaveEntry")}
                  style={{ minHeight: 44, padding: "0.55rem 1rem", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}
                >
                  {t("scope.save")}
                </button>
              </div>
            </div>
          </div>
        </div>,
            editEntryPortalEl,
          )
        : null}

      {reminderEntry && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: "var(--bd-z-modal)",
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setReminderEntry(null)}
        >
          <div
            className="bd-panel"
            style={{ padding: "1.25rem", maxWidth: 400, width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>{t("items.setReminder")}</h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "0 0 0.75rem" }}>{reminderEntry.title}</p>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem" }}>{t("items.dateTime")}</label>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
              <input
                type="date"
                className="bd-input"
                value={reminderEntry.reminderDate}
                onChange={(e) => setReminderEntry((p) => p && { ...p, reminderDate: e.target.value })}
                style={{ flex: "1 1 120px", padding: "0.35rem 0.5rem" }}
              />
              <input
                type="time"
                className="bd-input"
                value={reminderEntry.reminderTime}
                onChange={(e) => setReminderEntry((p) => p && { ...p, reminderTime: e.target.value })}
                style={{ flex: "1 1 100px", padding: "0.35rem 0.5rem" }}
              />
            </div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: "0.25rem" }}>{t("items.notifyMinutesBefore")}</label>
            <select
              className="bd-input"
              value={reminderEntry.reminderMinutesBefore}
              onChange={(e) => setReminderEntry((p) => p && { ...p, reminderMinutesBefore: Number(e.target.value) })}
              style={{ width: "100%", marginBottom: "1rem", padding: "0.35rem 0.5rem" }}
            >
              {REMINDER_MINUTES_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? "No early notification" : `${m} minutes before`}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" className="bd-btn" onClick={() => setReminderEntry(null)}>
                {t("scope.cancel")}
              </button>
              <button
                type="button"
                className="bd-btn"
                style={{ color: "var(--text-secondary)" }}
                onClick={() => {
                  updateReminder(reminderEntry.id, "", "", 0);
                  setReminderEntry(null);
                }}
              >
                {t("items.clearReminder")}
              </button>
              <button
                type="button"
                className="bd-btn bd-btn-primary"
                onClick={() => {
                  if (reminderEntry.reminderDate.trim()) {
                    updateReminder(
                      reminderEntry.id,
                      reminderEntry.reminderDate,
                      reminderEntry.reminderTime || "00:00",
                      reminderEntry.reminderMinutesBefore
                    );
                  }
                  setReminderEntry(null);
                }}
              >
                {t("scope.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

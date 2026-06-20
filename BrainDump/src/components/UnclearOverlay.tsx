"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { OrganizedItemPreview } from "./CenterPanel";

interface UnclearOverlayProps {
  items: OrganizedItemPreview[];
  projectNames: string[];
  onConfirm: (resolvedItems: OrganizedItemPreview[]) => void;
  onCancel: () => void;
}

const DOMAIN_OPTIONS = [
  { value: "work", labelKey: "unclear.domainWork" },
  { value: "personal", labelKey: "unclear.domainPersonal" },
  { value: "inbox", labelKey: "unclear.domainInbox" },
] as const;

const KIND_OPTIONS: { value: string; labelKey: string; category: Record<string, string> }[] = [
  { value: "task", labelKey: "unclear.kindTask", category: { work: "tasks", personal: "tasks", inbox: "unprocessed" } },
  { value: "note", labelKey: "unclear.kindNote", category: { work: "notes", personal: "thoughts", inbox: "unprocessed" } },
  { value: "calendar", labelKey: "unclear.kindCalendar", category: { work: "meetings", personal: "tasks", inbox: "unprocessed" } },
  { value: "shopping", labelKey: "unclear.kindShopping", category: { work: "tasks", personal: "shopping", inbox: "unprocessed" } },
  { value: "reflection", labelKey: "unclear.kindReflection", category: { work: "notes", personal: "feeling", inbox: "unprocessed" } },
  { value: "idea", labelKey: "unclear.kindIdea", category: { work: "ideas", personal: "hobbies", inbox: "unprocessed" } },
];

function defaultCategory(domain: string, itemType: string): string {
  const kind = KIND_OPTIONS.find((k) => k.value === itemType);
  if (!kind) return domain === "work" ? "tasks" : domain === "personal" ? "thoughts" : "unprocessed";
  return kind.category[domain as keyof typeof kind.category] ?? "unprocessed";
}

export function UnclearOverlay({ items, projectNames, onConfirm, onCancel }: UnclearOverlayProps) {
  const { t } = useI18n();
  const [edited, setEdited] = useState<OrganizedItemPreview[]>(() =>
    items.map((it) => ({
      ...it,
      domain: it.domain || "personal",
      category: it.category || defaultCategory(it.domain || "personal", it.item_type || "note"),
      item_type: it.item_type || "note",
    }))
  );
  const [showAdvanced, setShowAdvanced] = useState<Record<number, boolean>>({});

  const update = (index: number, updates: Partial<OrganizedItemPreview>) => {
    setEdited((prev) => prev.map((it, i) => (i === index ? { ...it, ...updates } : it)));
  };

  const setDomain = (index: number, domain: string) => {
    const item = edited[index];
    if (!item) return;
    update(index, {
      domain,
      category: defaultCategory(domain, item.item_type || "note"),
      project_name: domain === "work" ? item.project_name : undefined,
    });
  };

  const setKind = (index: number, itemType: string) => {
    const item = edited[index];
    if (!item) return;
    const domain = item.domain || "personal";
    update(index, {
      item_type: itemType,
      category: defaultCategory(domain, itemType),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unclear-title"
      className="bd-modal-backdrop"
      onClick={onCancel}
    >
      <div className="bd-modal-panel bd-unclear-panel" onClick={(e) => e.stopPropagation()}>
        <div className="bd-unclear-header">
          <h2 id="unclear-title">{t("unclear.heading")}</h2>
          <p>{t("unclear.body")}</p>
        </div>
        <div className="bd-unclear-body">
          {edited.map((it, index) => (
            <div key={index} className="bd-unclear-card">
              <div className="bd-unclear-card-title">{it.title}</div>
              {it.content ? <div className="bd-unclear-card-preview">{it.content}</div> : null}

              <div className="bd-unclear-question">
                <span className="bd-unclear-question-label">{t("unclear.questionDomain")}</span>
                <div className="bd-unclear-chip-row" role="group" aria-label={t("unclear.questionDomain")}>
                  {DOMAIN_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`bd-unclear-chip${it.domain === opt.value ? " bd-unclear-chip--active" : ""}`}
                      aria-pressed={it.domain === opt.value}
                      onClick={() => setDomain(index, opt.value)}
                    >
                      {t(opt.labelKey)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bd-unclear-question">
                <span className="bd-unclear-question-label">{t("unclear.questionKind")}</span>
                <div className="bd-unclear-chip-row" role="group" aria-label={t("unclear.questionKind")}>
                  {KIND_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`bd-unclear-chip${it.item_type === opt.value ? " bd-unclear-chip--active" : ""}`}
                      aria-pressed={it.item_type === opt.value}
                      onClick={() => setKind(index, opt.value)}
                    >
                      {t(opt.labelKey)}
                    </button>
                  ))}
                </div>
              </div>

              {(it.domain === "work" && projectNames.length > 0) || showAdvanced[index] ? (
                <div className="bd-unclear-advanced">
                  {it.domain === "work" && projectNames.length > 0 ? (
                    <label className="bd-unclear-field">
                      <span>{t("unclear.projectOptional")}</span>
                      <select
                        className="bd-input"
                        value={it.project_name ?? ""}
                        onChange={(e) => update(index, { project_name: e.target.value || undefined })}
                      >
                        <option value="">{t("menu.noProject")}</option>
                        {projectNames.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {showAdvanced[index] ? (
                    <label className="bd-unclear-field">
                      <span>{t("unclear.categoryAdvanced")}</span>
                      <input
                        className="bd-input"
                        value={it.category}
                        onChange={(e) => update(index, { category: e.target.value })}
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}

              {!showAdvanced[index] ? (
                <button
                  type="button"
                  className="bd-unclear-advanced-toggle"
                  onClick={() => setShowAdvanced((prev) => ({ ...prev, [index]: true }))}
                >
                  {t("unclear.showAdvanced")}
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <div className="bd-unclear-footer">
          <button type="button" className="bd-btn" onClick={onCancel}>
            {t("unclear.useAiGuess")}
          </button>
          <button type="button" className="bd-btn bd-btn-primary" onClick={() => onConfirm(edited)}>
            {t("unclear.applyContinue")}
          </button>
        </div>
      </div>
    </div>
  );
}

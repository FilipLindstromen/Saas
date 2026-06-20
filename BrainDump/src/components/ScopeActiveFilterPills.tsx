"use client";

import { useI18n } from "@/lib/i18n";
import type { DueDateFilterPreset } from "@/lib/due-date-filter";

const DUE_DATE_LABEL_KEY: Record<DueDateFilterPreset, string> = {
  all: "scope.dateFilterNone",
  today: "scope.dateFilterToday",
  tomorrow: "scope.dateFilterTomorrow",
  this_week: "scope.dateFilterThisWeek",
  no_date: "scope.dateFilterNoDate",
};

type Props = {
  searchFilter: string;
  dueDateFilter: DueDateFilterPreset;
  scopeLabel?: string | null;
  onClearSearch: () => void;
  onClearDueDate: () => void;
  onClearScope?: () => void;
};

export function ScopeActiveFilterPills({
  searchFilter,
  dueDateFilter,
  scopeLabel,
  onClearSearch,
  onClearDueDate,
  onClearScope,
}: Props) {
  const { t } = useI18n();
  const pills: { key: string; label: string; onClear: () => void }[] = [];

  if (scopeLabel) {
    pills.push({ key: "scope", label: scopeLabel, onClear: () => onClearScope?.() });
  }
  if (searchFilter.trim()) {
    pills.push({ key: "search", label: `"${searchFilter.trim()}"`, onClear: onClearSearch });
  }
  if (dueDateFilter !== "all") {
    pills.push({ key: "due", label: t(DUE_DATE_LABEL_KEY[dueDateFilter]), onClear: onClearDueDate });
  }

  if (pills.length === 0) return null;

  return (
    <div className="bd-scope-active-pills" role="list" aria-label={t("scope.activeFiltersAria")}>
      {pills.map((pill) => (
        <span key={pill.key} className="bd-scope-active-pill" role="listitem">
          <span className="bd-scope-active-pill-label">{pill.label}</span>
          <button
            type="button"
            className="bd-scope-active-pill-clear"
            aria-label={t("scope.removeFilter", { filter: pill.label })}
            onClick={pill.onClear}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

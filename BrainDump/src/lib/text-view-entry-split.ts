import { PERSONAL_AREA_DEFAULTS } from "@/lib/personal-areas";

export type TextViewEntryPart = { title: string; content: string };

const PERSONAL_AREA_SET = new Set(PERSONAL_AREA_DEFAULTS);

/** Split on blank lines (double line break). */
export function splitTextViewBlocks(raw: string): string[] {
  return raw
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
}

/**
 * One block: if titles shown, first line = headline, rest = description.
 * If titles hidden, entire block = description (title left empty for caller to derive).
 */
export function parseTextViewBlock(block: string, showEntryTitles: boolean): TextViewEntryPart {
  if (!showEntryTitles) {
    return { title: "", content: block.trim() };
  }
  const nl = block.indexOf("\n");
  if (nl === -1) {
    return { title: block.trim(), content: "" };
  }
  return {
    title: block.slice(0, nl).trim(),
    content: block.slice(nl + 1).trim(),
  };
}

export function deriveEntryTitle(title: string, content: string): string {
  const t = title.trim();
  if (t) return t;
  const first = content.split("\n").find((l) => l.trim())?.trim() ?? "";
  if (first) return first.length > 140 ? `${first.slice(0, 140)}…` : first;
  return "Untitled";
}

export type TextSplitScope = {
  dumpMode: "inbox" | "work" | "personal";
  domain: string;
  category: string;
  projectId: string | null;
};

/**
 * Map workspace filters to new-item domain / area / project.
 * "All + all areas + no project" → inbox + uncategorized.
 */
export function resolveTextSplitScope(
  mode: string,
  projectId: string | null,
  category: string | null,
  options?: { personalAreaIds?: Set<string> }
): TextSplitScope {
  const cat = category?.trim() || null;
  const proj = projectId?.trim() || null;

  if (mode === "all" && !proj && !cat) {
    return { dumpMode: "inbox", domain: "inbox", category: "uncategorized", projectId: null };
  }

  if (mode === "work") {
    return {
      dumpMode: "work",
      domain: "work",
      category: cat || "projects",
      projectId: proj,
    };
  }

  if (mode === "personal") {
    return {
      dumpMode: "personal",
      domain: "personal",
      category: cat || "thoughts",
      projectId: null,
    };
  }

  if (mode === "all" && proj) {
    return {
      dumpMode: "work",
      domain: "work",
      category: cat || "projects",
      projectId: proj,
    };
  }

  if (mode === "all" && cat) {
    const personalIds = options?.personalAreaIds;
    const isPersonalArea =
      PERSONAL_AREA_SET.has(cat) || (personalIds && personalIds.has(cat));
    if (isPersonalArea) {
      return { dumpMode: "personal", domain: "personal", category: cat, projectId: null };
    }
    return { dumpMode: "work", domain: "work", category: cat, projectId: null };
  }

  return { dumpMode: "inbox", domain: "inbox", category: "uncategorized", projectId: null };
}

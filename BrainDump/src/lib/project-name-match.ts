/**
 * Map AI/user project names to existing app project names (avoid near-duplicates).
 * Used by organize flow and when creating projects from voice.
 */

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[n]!;
}

const normAlnum = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

/** Removes spoken "and" between syllables (e.g. Relax**and**experience → matches Relaxperience). */
const normAlnumWithoutAnd = (s: string) => normAlnum(s).replace(/and/g, "");

function diceBigramSimilarity(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = (s: string) => {
    const arr: string[] = [];
    for (let i = 0; i < s.length - 1; i++) arr.push(s.slice(i, i + 2));
    return arr;
  };
  const A = bigrams(a);
  const B = bigrams(b);
  const mapB = new Map<string, number>();
  for (const x of B) mapB.set(x, (mapB.get(x) ?? 0) + 1);
  let inter = 0;
  for (const x of A) {
    const c = mapB.get(x) ?? 0;
    if (c > 0) {
      inter++;
      mapB.set(x, c - 1);
    }
  }
  return (2 * inter) / (A.length + B.length);
}

/** Pick canonical name from `existing` if `aiName` clearly refers to the same project; otherwise return trimmed `aiName`. */
export function resolveProjectNameToCanonical(aiName: string, existing: string[]): string {
  const t = aiName.trim();
  if (!t || existing.length === 0) return t;
  const lower = t.toLowerCase();
  for (const p of existing) {
    if (p.toLowerCase() === lower) return p;
  }
  const tn = normAlnum(t);
  for (const p of existing) {
    const pn = normAlnum(p);
    if (!pn || !tn) continue;
    if (pn === tn) return p;
    const minL = Math.min(pn.length, tn.length);
    if (minL >= 6 && (pn.includes(tn) || tn.includes(pn))) return p;
  }
  const tNoAnd = normAlnumWithoutAnd(t);
  for (const p of existing) {
    const pn = normAlnumWithoutAnd(p);
    if (tNoAnd.length >= 8 && pn.length >= 8 && tNoAnd === pn) return p;
  }
  for (const p of existing) {
    const pl = p.toLowerCase();
    if (pl.length >= 6 && lower.length >= 6) {
      const d = levenshtein(lower, pl);
      const maxD = Math.min(4, Math.floor(Math.min(lower.length, pl.length) / 3));
      if (d <= maxD && d <= 4) return p;
    }
  }
  for (const p of existing) {
    const pn = normAlnum(p);
    if (tn.length >= 10 && pn.length >= 10) {
      const sim = diceBigramSimilarity(tn, pn);
      if (sim >= 0.72) return p;
    }
  }
  return t;
}

/**
 * Extract work project names the user asked to create explicitly (EN/SV).
 * Used to populate standalone_project_creations when the model still returns a useless note.
 */
export function extractExplicitWorkProjectNames(transcript: string): string[] {
  const text = transcript.trim();
  if (!text) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string | undefined) => {
    const s = raw?.replace(/^["'“”\s]+|["'“”\s]+$/g, "").trim();
    if (!s || s.length > 120) return;
    const k = s.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(s);
  };

  const en = [
    /\b(?:create|add|make|start|open)\s+(?:a\s+|an\s+|the\s+|my\s+)?(?:new\s+)?(?:work\s+)?project\s+(?:called|caled|named|titled)\s+["']?([^\n"'.!?]+?)["']?(?:\s*[.!?]|$)/gi,
    /\b(?:create|add|make|start)\s+(?:a\s+|an\s+)?(?:new\s+)?project\s+["']?([^\n"'.!?]+?)["']?(?:\s*[.!?]|$)/gi,
    /\bnew\s+project\s+(?:called|named)\s+["']?([^\n"'.!?]+?)["']?(?:\s*[.!?]|$)/gi,
    /\bproject\s+(?:called|named)\s+["']?([^\n"'.!?]+?)["']?(?:\s*[.!?]|$)/gi,
  ];
  const sv = [
    /\b(?:skapa|starta|lägg\s+til)\s+(?:ett\s+|mitt\s+)?(?:nytt\s+)?(?:arbets)?projekt\s+(?:som\s+heter|kallat|kallade|med\s+namnet|heta)\s+["']?([^\n"'.!?]+?)["']?(?:\s*[.!?]|$)/gi,
    /\b(?:nytt|nytt\s+arbets)?projekt\s+(?:som\s+heter|kallat)\s+["']?([^\n"'.!?]+?)["']?(?:\s*[.!?]|$)/gi,
  ];
  for (const re of [...en, ...sv]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      add(m[1]);
    }
  }
  return out;
}

/** Drop work notes/ideas that only echo "create a project called X" without real content. */
export function filterRedundantProjectCreationNotes<
  T extends { domain?: string; item_type?: string; title?: string; content?: string },
>(items: T[], transcript: string, explicitNames: string[]): T[] {
  if (explicitNames.length === 0) return items;
  const createCue =
    /\b(create|add|new\s+project|make\s+a\s+project|skapa|nytt\s+projekt|projekt\s+som\s+heter|lägg\s+til\s+ett\s+projekt)\b/i.test(
      transcript
    );
  if (!createCue) return items;

  return items.filter((it) => {
    const dom = (it.domain ?? "").toLowerCase();
    if (dom !== "work") return true;
    const ty = (it.item_type ?? "note").toLowerCase();
    if (ty !== "note" && ty !== "idea") return true;
    const title = (it.title ?? "").trim().toLowerCase();
    const content = (it.content ?? "").trim().toLowerCase();
    const blob = `${title} ${content}`.trim();
    if (blob.length > 280) return true;
    const mentionsName = explicitNames.some((n) => {
      const x = n.trim().toLowerCase();
      return x.length > 0 && blob.includes(x);
    });
    if (!mentionsName) return true;
    const titleMeta =
      /^(new\s+project|create\s+project|project\s+creation|nytt\s+projekt|skapa\s+projekt|projekt)/i.test(it.title ?? "");
    const fewExtraWords = blob.split(/\s+/).filter(Boolean).length <= 18;
    if (titleMeta && fewExtraWords) return false;
    if (blob.length < 120 && fewExtraWords && content.split(/\s+/).length <= 14) return false;
    return true;
  });
}

/** True if `name` already matches an entry in `existing` (exact, fuzzy, or canonical resolution). */
export function workProjectAlreadyExists(name: string, existing: string[]): boolean {
  const t = name.trim();
  if (!t || existing.length === 0) return false;
  if (existing.some((e) => e.toLowerCase() === t.toLowerCase())) return true;
  const resolved = resolveProjectNameToCanonical(t, existing);
  return existing.some((e) => e.toLowerCase() === resolved.toLowerCase());
}

/** Names to create: not empty, deduped, skip ones that already exist. */
export function filterNewStandaloneProjectNames(names: string[], existing: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const s = raw.trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    if (workProjectAlreadyExists(s, existing)) continue;
    out.push(s);
  }
  return out;
}

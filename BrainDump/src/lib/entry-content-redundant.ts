/**
 * Detect when entry body text repeats the headline with little or no extra detail,
 * so lists can show the title only.
 */

const STOPWORDS = new Set(
  [
    // English
    "the",
    "a",
    "an",
    "to",
    "be",
    "is",
    "are",
    "was",
    "were",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "should",
    "could",
    "shall",
    "may",
    "might",
    "must",
    "need",
    "needs",
    "ought",
    "i",
    "you",
    "he",
    "she",
    "it",
    "we",
    "they",
    "them",
    "their",
    "this",
    "that",
    "these",
    "those",
    "what",
    "which",
    "who",
    "whom",
    "if",
    "or",
    "as",
    "of",
    "at",
    "by",
    "for",
    "with",
    "about",
    "from",
    "into",
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "up",
    "down",
    "in",
    "out",
    "on",
    "off",
    "over",
    "under",
    "again",
    "then",
    "once",
    "here",
    "there",
    "when",
    "where",
    "why",
    "how",
    "all",
    "each",
    "both",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "no",
    "nor",
    "not",
    "only",
    "own",
    "same",
    "so",
    "than",
    "too",
    "very",
    "just",
    "can",
    "also",
    "and",
    "but",
    "because",
    "any",
    "every",
    "ever",
    "still",
    "even",
    "get",
    "gets",
    "got",
    "getting",
    "gotten",
    // Swedish
    "och",
    "att",
    "i",
    "en",
    "ett",
    "som",
    "på",
    "är",
    "för",
    "med",
    "till",
    "av",
    "om",
    "det",
    "den",
    "de",
    "har",
    "inte",
    "du",
    "ni",
    "vi",
    "han",
    "hon",
    "man",
    "sig",
    "så",
    "ut",
    "var",
    "vad",
    "vilken",
    "vilket",
    "vilka",
    "när",
    "där",
    "här",
    "från",
    "ska",
    "skall",
    "skulle",
    "kan",
    "måste",
    "bör",
    "får",
    "blir",
    "bli",
    "vara",
    "vår",
    "våra",
    "vårt",
    "denna",
    "detta",
    "dessa",
  ].map((w) => w.toLowerCase())
);

function tokenize(text: string): string[] {
  const s = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  return s
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/** Very light normalization so "design" ≈ "designed", "icons" ≈ "icon". */
function stemToken(w: string): string {
  if (w.length <= 2) return w;
  if (/^\p{N}+$/u.test(w)) return w;
  let s = w;
  if (s.length > 5 && s.endsWith("iness")) return s.slice(0, -5);
  if (s.length > 5 && s.endsWith("ness")) return s.slice(0, -4);
  if (s.length > 5 && s.endsWith("ment")) return s.slice(0, -4);
  if (s.length > 5 && s.endsWith("ingly")) return s.slice(0, -5);
  if (s.length > 4 && s.endsWith("ing")) return s.slice(0, -3);
  if (s.length > 4 && s.endsWith("ed")) return s.slice(0, -2);
  if (s.length > 4 && /\p{L}/u.test(s) && s.endsWith("es") && !s.endsWith("ss")) return s.slice(0, -2);
  if (s.length > 4 && /\p{L}/u.test(s) && s.endsWith("s") && !s.endsWith("ss")) return s.slice(0, -1);
  return s;
}

function substantiveStemSet(title: string): Set<string> {
  const out = new Set<string>();
  for (const w of tokenize(title)) {
    if (STOPWORDS.has(w)) continue;
    out.add(stemToken(w));
  }
  return out;
}

/**
 * True when `content` adds no meaningful tokens beyond what's already expressed in `title`.
 * Empty or whitespace-only body is not considered redundant (nothing to hide).
 */
export function isContentRedundantWithTitle(title: string | null | undefined, content: string | null | undefined): boolean {
  const body = (content ?? "").trim();
  if (!body) return false;
  const t = (title ?? "").trim();
  if (!t) return false;

  const titleStems = substantiveStemSet(t);
  const bodyTokens = tokenize(body).filter((w) => !STOPWORDS.has(w));
  if (bodyTokens.length === 0) return true;

  for (const w of bodyTokens) {
    const stem = stemToken(w);
    if (titleStems.has(stem)) continue;
    if (/\p{N}/u.test(w)) {
      const titleHasSameToken = tokenize(t).some((tw) => !STOPWORDS.has(tw) && tw === w);
      if (!titleHasSameToken) return false;
      continue;
    }
    return false;
  }
  return true;
}

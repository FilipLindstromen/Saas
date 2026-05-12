"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import hookTransformInstructions from "@/data/hook-transform-instructions.json";
import {
  type AppLanguage,
  type CalendarHookDayInput,
  type ExpansionPack,
  type ScriptStoryboard,
  type RedditTopicPost,
  generateContentIdeas,
  generateCalendarHooks,
  generateHookVariations,
  generateNetflixifyScripts,
  generateRedditStyleTopicsFromHooks,
  generateScriptStoryboard,
  generateTrendingHooks,
  generateWinningHookExpansion,
  rewriteWinningHook,
  HOOK_COLUMN_LABELS,
  type HookVariation,
} from "@/lib/generate-hooks";
import { loadSharedOpenAiKey } from "@/lib/saas-api-keys";
import { ThemeToggle } from "@/components/theme-toggle";

const DEFAULT_AUDIENCE = "High-performing professionals";
const DEFAULT_LIGHTHOUSE = "Your problems aren't in your head, they are in your body.";
const DEFAULT_LANGUAGE: AppLanguage = "English";
const STORAGE_KEY = "hook-transformer-state-v2";
const PLATFORMS = ["Instagram Reel", "Instagram Carousel", "Instagram AD (lead magnet / low ticket)", "TikTok", "YouTube Shorts"] as const;
const STYLE_PRESETS = ["Casual", "Direct", "Curious", "Bold", "Empathetic"] as const;
const REFERENCE_CAROUSEL = {
  // Percent-based geometry on a 1080x1440 artboard
  leftInset: "10%",
  headlineWidth: "74%",
  bodyWidth: "66%",
  topAnchor: "44%",
  bottomTop: "73%",
  underlineTop: "63%",
  underlineWidth: "56%",
  headlineRotationDeg: -6,
  headlineSize: 72,
  bodySize: 38,
} as const;

type ResultItem = HookVariation & {
  id: string;
};

type SavedItem = ResultItem & {
  sourceHook: string;
  targetAudience: string;
  platform: string;
  stylePreset: string;
  savedAt: string;
};

type IdeaItem = {
  id: string;
  text: string;
};

type IdeaBatch = {
  id: string;
  hookId: string;
  hookText: string;
  platform: string;
  targetAudience: string;
  createdAt: string;
  ideas: IdeaItem[];
};

type FavoriteIdea = {
  id: string;
  text: string;
  hookText: string;
  platform: string;
  targetAudience: string;
  savedAt: string;
};

type ExpansionBatch = {
  id: string;
  hookText: string;
  createdAt: string;
  groups: {
    rewrites: ResultItem[];
    painHooks: ResultItem[];
    curiosityHooks: ResultItem[];
  };
};

type ScriptBoardEntry = {
  id: string;
  hookText: string;
  platform: string;
  targetAudience: string;
  createdAt: string;
  package: ScriptStoryboard;
};

type NetflixifyBatch = {
  id: string;
  hookText: string;
  platform: string;
  targetAudience: string;
  createdAt: string;
  scripts: ScriptStoryboard[];
};

type CarouselLayout = {
  id: string;
  name: string;
  titleClass: string;
  bodyClass: string;
  cardClass: string;
  headlineX?: number;
  headlineY?: number;
  headlineWidth?: number;
  bodyX?: number;
  bodyY?: number;
  bodyWidth?: number;
  headlineFontSize?: number;
  bodyFontSize?: number;
};

type CarouselSlide = {
  id: string;
  headline: string;
  body: string;
  headlineHtml?: string;
  bodyHtml?: string;
  layoutId: string;
  textAlign?: "left" | "center";
  tone?: "soft" | "dark" | "accent";
  headlineSize?: number;
  bodySize?: number;
};

type CarouselDraft = {
  id: string;
  name: string;
  createdAt: string;
  slides: CarouselSlide[];
};

type CalendarEntry = {
  id: string;
  week: number;
  day: string;
  topicSlot: "topic1" | "topic2";
  hookType: string;
  format: string;
  hookText: string;
  locked: boolean;
  completed: boolean;
};

const CALENDAR_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Hook types shown in calendar (matches reference content calendar). */
const CALENDAR_HOOK_TYPES = ["Question hook", "Story hook", "Negative hook", "Contrarian hook", "Number hook"] as const;

const CALENDAR_FORMAT_OPTIONS = ["Direct to camera", "Broll + Text", "Carousel"] as const;

/** Hook Variants column labels → calendar `hookType` (reference grid / dropdown values). */
const VARIANT_COLUMN_TO_CALENDAR_HOOK: Record<
  (typeof HOOK_COLUMN_LABELS)[number],
  (typeof CALENDAR_HOOK_TYPES)[number]
> = {
  "Ask a question Hook": "Question hook",
  "Story hook": "Story hook",
  "Negative hook": "Negative hook",
  "Contrarian view": "Contrarian hook",
  "Numbered list": "Number hook",
};

function calendarDaySortIndex(day: string): number {
  const i = CALENDAR_DAYS.indexOf(day as (typeof CALENDAR_DAYS)[number]);
  return i >= 0 ? i : 0;
}

/** Topic / hook-type / format distribution from the reference 4-week grid (Mon→Sun). */
type CalendarCellRef = { topic: "topic1" | "topic2"; hookType: (typeof CALENDAR_HOOK_TYPES)[number]; format: (typeof CALENDAR_FORMAT_OPTIONS)[number] };

const CALENDAR_REFERENCE_GRID: CalendarCellRef[][] = [
  [
    { topic: "topic1", hookType: "Question hook", format: "Direct to camera" },
    { topic: "topic2", hookType: "Number hook", format: "Broll + Text" },
    { topic: "topic1", hookType: "Negative hook", format: "Carousel" },
    { topic: "topic1", hookType: "Contrarian hook", format: "Direct to camera" },
    { topic: "topic2", hookType: "Question hook", format: "Carousel" },
    { topic: "topic1", hookType: "Story hook", format: "Broll + Text" },
    { topic: "topic2", hookType: "Story hook", format: "Carousel" },
  ],
  [
    { topic: "topic2", hookType: "Question hook", format: "Broll + Text" },
    { topic: "topic1", hookType: "Negative hook", format: "Direct to camera" },
    { topic: "topic2", hookType: "Question hook", format: "Direct to camera" },
    { topic: "topic1", hookType: "Question hook", format: "Carousel" },
    { topic: "topic1", hookType: "Contrarian hook", format: "Broll + Text" },
    { topic: "topic2", hookType: "Contrarian hook", format: "Direct to camera" },
    { topic: "topic1", hookType: "Number hook", format: "Direct to camera" },
  ],
  [
    { topic: "topic1", hookType: "Number hook", format: "Broll + Text" },
    { topic: "topic1", hookType: "Story hook", format: "Carousel" },
    { topic: "topic2", hookType: "Negative hook", format: "Broll + Text" },
    { topic: "topic2", hookType: "Contrarian hook", format: "Carousel" },
    { topic: "topic1", hookType: "Question hook", format: "Broll + Text" },
    { topic: "topic1", hookType: "Contrarian hook", format: "Carousel" },
    { topic: "topic2", hookType: "Contrarian hook", format: "Broll + Text" },
  ],
  [
    { topic: "topic2", hookType: "Story hook", format: "Broll + Text" },
    { topic: "topic1", hookType: "Story hook", format: "Direct to camera" },
    { topic: "topic2", hookType: "Negative hook", format: "Direct to camera" },
    { topic: "topic1", hookType: "Number hook", format: "Carousel" },
    { topic: "topic2", hookType: "Negative hook", format: "Carousel" },
    { topic: "topic2", hookType: "Number hook", format: "Direct to camera" },
    { topic: "topic1", hookType: "Negative hook", format: "Broll + Text" },
  ],
];

const CALENDAR_LAYOUT_VERSION = 2;

const calendarAhaLoadingKey = (entryId: string) => `cal-aha-${entryId}`;
const calendarScriptLoadingKey = (entryId: string) => `cal-script-${entryId}`;

function getDefaultCarouselLayouts(): CarouselLayout[] {
  return [
    {
      id: "layout-minimal",
      name: "Hook poster",
      titleClass: "font-caveat inline-block border-b-4 border-black/80 pb-2 text-5xl leading-[0.95] text-[#111111] sm:text-6xl",
      bodyClass: "font-nourd mt-14 max-w-[86%] text-2xl font-semibold leading-tight text-[#222222] sm:text-3xl",
      cardClass: "rounded-none border-0 px-8 py-16 sm:px-12",
      headlineX: 10,
      headlineY: 16,
      headlineWidth: 76,
      bodyX: 10,
      bodyY: 66,
      bodyWidth: 66,
      headlineFontSize: 50,
      bodyFontSize: 28,
    },
    {
      id: "layout-bold",
      name: "Bold contrast",
      titleClass: "text-2xl font-extrabold uppercase tracking-wide text-[var(--text-primary)]",
      bodyClass: "mt-3 text-sm leading-relaxed text-[var(--text-secondary)]",
      cardClass: "rounded-2xl border-2 p-5",
      headlineX: 8,
      headlineY: 12,
      headlineWidth: 84,
      bodyX: 8,
      bodyY: 58,
      bodyWidth: 84,
      headlineFontSize: 44,
      bodyFontSize: 24,
    },
    {
      id: "layout-story",
      name: "Story card",
      titleClass: "text-lg font-semibold italic text-[var(--text-primary)]",
      bodyClass: "mt-2 text-sm leading-relaxed text-[var(--text-secondary)]",
      cardClass: "rounded-3xl border p-6",
      headlineX: 10,
      headlineY: 14,
      headlineWidth: 80,
      bodyX: 10,
      bodyY: 60,
      bodyWidth: 80,
      headlineFontSize: 40,
      bodyFontSize: 24,
    },
  ];
}

function mergeWithDefaultCarouselLayouts(existing: CarouselLayout[]): CarouselLayout[] {
  const defaults = getDefaultCarouselLayouts();
  const byId = new Map(existing.map((layout) => [layout.id, layout]));
  return defaults.map((base) => {
    const custom = byId.get(base.id);
    if (!custom) return base;
    return {
      ...base,
      // Keep custom name, but keep the updated style classes so the visual system stays consistent.
      name: custom.name || base.name,
    };
  });
}

function buildSlidesFromText(text: string, layoutId: string): CarouselSlide[] {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const chunks = parts.length > 0 ? parts : [text.trim()].filter(Boolean);
  const limited = chunks.slice(0, 8);
  return limited.map((chunk, idx) => ({
    id: makeId(),
    headline: idx === 0 ? chunk : `Slide ${idx + 1}`,
    body: idx === 0 ? "Add the supporting line here." : chunk,
    layoutId,
    textAlign: "left",
    tone: "soft",
    headlineSize: idx === 0 ? 72 : 42,
    bodySize: idx === 0 ? 38 : 30,
  }));
}

function toHeadlineAndSubheadline(raw: string): { headline: string; subheadline: string } {
  const cleaned = raw.replace(/^\d+[\).\-\s]*/, "").replace(/^[-•]\s*/, "").trim();
  if (!cleaned) {
    return { headline: "Slide", subheadline: "" };
  }
  const colonSplit = cleaned.split(/:\s+/);
  if (colonSplit.length > 1) {
    const headline = colonSplit[0].trim();
    const subheadline = colonSplit.slice(1).join(": ").trim();
    return { headline: headline || "Slide", subheadline };
  }
  const words = cleaned.split(/\s+/);
  const headlineWords = words.slice(0, Math.min(6, words.length));
  const subWords = words.slice(headlineWords.length);
  return {
    headline: headlineWords.join(" "),
    subheadline: subWords.join(" "),
  };
}

function buildHeadlineSubheadlineSlidesFromText(text: string, layoutId: string): CarouselSlide[] {
  const chunks = text
    .split(/\n+/)
    .flatMap((block) => block.split(/(?<=[.!?])\s+/))
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .slice(0, 10);

  return chunks.map((chunk, idx) => {
    const pair = toHeadlineAndSubheadline(chunk);
    return {
      id: makeId(),
      headline: pair.headline || `Slide ${idx + 1}`,
      body: pair.subheadline || "",
      headlineHtml: textToHtml(pair.headline || `Slide ${idx + 1}`),
      bodyHtml: textToHtml(pair.subheadline || ""),
      layoutId,
      textAlign: "left",
      tone: idx === 0 ? "soft" : "soft",
      headlineSize: idx === 0 ? 72 : 42,
      bodySize: idx === 0 ? 38 : 30,
    };
  });
}

function textToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function clampPercent(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getDefaultCalendarEntries(): CalendarEntry[] {
  const entries: CalendarEntry[] = [];
  for (let w = 0; w < 4; w += 1) {
    for (let d = 0; d < 7; d += 1) {
      const cell = CALENDAR_REFERENCE_GRID[w][d];
      entries.push({
        id: makeId(),
        week: w + 1,
        day: CALENDAR_DAYS[d],
        topicSlot: cell.topic,
        hookType: cell.hookType,
        format: cell.format,
        hookText: "",
        locked: false,
        completed: false,
      });
    }
  }
  return entries;
}

function normalizeCalendarEntries(entries: CalendarEntry[]): CalendarEntry[] {
  return entries.map((e) => ({
    ...e,
    completed: typeof e.completed === "boolean" ? e.completed : false,
  }));
}

/** Re-apply reference topic / hook-type / format while preserving ids, hook text, and locks. */
function mergeCalendarWithReferenceGrid(existing: CalendarEntry[]): CalendarEntry[] {
  const byWeekDay = new Map<string, CalendarEntry>();
  for (const e of existing) {
    byWeekDay.set(`${e.week}-${e.day}`, e);
  }
  const next: CalendarEntry[] = [];
  for (let w = 0; w < 4; w += 1) {
    for (let d = 0; d < 7; d += 1) {
      const week = w + 1;
      const day = CALENDAR_DAYS[d];
      const ref = CALENDAR_REFERENCE_GRID[w][d];
      const prev = byWeekDay.get(`${week}-${day}`);
      if (prev) {
        next.push({
          ...prev,
          topicSlot: ref.topic,
          hookType: ref.hookType,
          format: ref.format,
        });
      } else {
        next.push({
          id: makeId(),
          week,
          day,
          topicSlot: ref.topic,
          hookType: ref.hookType,
          format: ref.format,
          hookText: "",
          locked: false,
          completed: false,
        });
      }
    }
  }
  return normalizeCalendarEntries(next);
}

function toResultItems(hooks: HookVariation[]): ResultItem[] {
  return hooks.map((item) => ({
    ...item,
    id: makeId(),
  }));
}

function toExpansionGroups(pack: ExpansionPack) {
  return {
    rewrites: toResultItems(pack.rewrites),
    painHooks: toResultItems(pack.painHooks),
    curiosityHooks: toResultItems(pack.curiosityHooks),
  };
}

function CalendarLockGlyph({ locked }: { locked: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      {locked ? <path d="M7 11V7a5 5 0 0 1 10 0v4" /> : <path d="M7 11V7a5 5 0 0 1 9.9-1" />}
    </svg>
  );
}

function CalendarHookAutosizeTextarea({
  value,
  onChange,
  className,
  style,
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const syncHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    syncHeight();
  }, [value, syncHeight]);

  useEffect(() => {
    window.addEventListener("resize", syncHeight);
    return () => window.removeEventListener("resize", syncHeight);
  }, [syncHeight]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      style={{
        ...style,
        resize: "none",
        overflow: "hidden",
        minHeight: "3.25rem",
      }}
    />
  );
}

const MAIN_VIEWS = ["variants", "calendar", "aha", "script", "carousel", "reddit"] as const;

function mainViewTabLabel(view: (typeof MAIN_VIEWS)[number], appLanguage: AppLanguage): string {
  const sv = appLanguage === "Swedish";
  switch (view) {
    case "variants":
      return sv ? "Hookvarianter" : "Hook Variants";
    case "calendar":
      return sv ? "Kalender" : "Calendar";
    case "aha":
      return sv ? "Aha + slutsats" : "Aha + conclusion";
    case "script":
      return sv ? "Manus" : "Script";
    case "carousel":
      return sv ? "Karusell" : "Carousel";
    case "reddit":
      return sv ? "Reddit-ämnen" : "Reddit topics";
  }
}

export default function HomePage() {
  const VIEWS = MAIN_VIEWS;
  type View = (typeof VIEWS)[number];

  const [targetAudience, setTargetAudience] = useState(DEFAULT_AUDIENCE);
  const [topicOne, setTopicOne] = useState("Topic 1");
  const [topicTwo, setTopicTwo] = useState("Topic 2");
  const [showInputSettings, setShowInputSettings] = useState(false);
  const [appLanguage, setAppLanguage] = useState<AppLanguage>(DEFAULT_LANGUAGE);
  const [lighthouseHeadline, setLighthouseHeadline] = useState(DEFAULT_LIGHTHOUSE);
  const [topicOneHook, setTopicOneHook] = useState("");
  const [topicTwoHook, setTopicTwoHook] = useState("");
  const [topicOnePerspective, setTopicOnePerspective] = useState("");
  const [topicTwoPerspective, setTopicTwoPerspective] = useState("");
  const [curiosityLevel, setCuriosityLevel] = useState(0.5);
  const [useContrarianHook, setUseContrarianHook] = useState(false);
  const [useBrandVoiceLock, setUseBrandVoiceLock] = useState(false);
  const [brandVoiceSample, setBrandVoiceSample] = useState("");
  const [netflixConflictLevel, setNetflixConflictLevel] = useState(0.7);
  const [netflixDramaLevel, setNetflixDramaLevel] = useState(0.7);
  const [netflixEndingStyle, setNetflixEndingStyle] = useState<"hopeful" | "urgent" | "reflective">("reflective");
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>("Instagram Reel");
  const [stylePreset, setStylePreset] = useState<(typeof STYLE_PRESETS)[number]>("Casual");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [favorites, setFavorites] = useState<SavedItem[]>([]);
  const [ideaBatches, setIdeaBatches] = useState<IdeaBatch[]>([]);
  const [favoriteIdeas, setFavoriteIdeas] = useState<FavoriteIdea[]>([]);
  const [expansionBatches, setExpansionBatches] = useState<ExpansionBatch[]>([]);
  const [scriptBoards, setScriptBoards] = useState<ScriptBoardEntry[]>([]);
  const [netflixifyBatches, setNetflixifyBatches] = useState<NetflixifyBatch[]>([]);
  const [redditTopicPosts, setRedditTopicPosts] = useState<RedditTopicPost[]>([]);
  const [redditTopicsLoading, setRedditTopicsLoading] = useState(false);
  const [carouselLayouts, setCarouselLayouts] = useState<CarouselLayout[]>(getDefaultCarouselLayouts);
  const [carouselDrafts, setCarouselDrafts] = useState<CarouselDraft[]>([]);
  const [activeCarouselId, setActiveCarouselId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Generating...");
  const [rewritingId, setRewritingId] = useState<string | null>(null);
  const [ideasLoadingId, setIdeasLoadingId] = useState<string | null>(null);
  const [expandingId, setExpandingId] = useState<string | null>(null);
  const [scriptLoadingId, setScriptLoadingId] = useState<string | null>(null);
  const [netflixifyLoadingId, setNetflixifyLoadingId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<View>("variants");
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>(getDefaultCalendarEntries);
  const [layoutDrag, setLayoutDrag] = useState<{ layoutId: string; target: "headline" | "body" } | null>(null);
  const [carouselStudioSlideIdx, setCarouselStudioSlideIdx] = useState(0);
  const prevActiveCarouselIdRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        targetAudience: string;
        topicOne: string;
        topicTwo: string;
        showInputSettings: boolean;
        appLanguage: AppLanguage;
        lighthouseHeadline: string;
        hook?: string;
        uniquePerspective?: string;
        topicOneHook?: string;
        topicTwoHook?: string;
        topicOnePerspective?: string;
        topicTwoPerspective?: string;
        curiosityLevel: number;
        useContrarianHook: boolean;
        useBrandVoiceLock: boolean;
        brandVoiceSample: string;
        netflixConflictLevel: number;
        netflixDramaLevel: number;
        netflixEndingStyle: "hopeful" | "urgent" | "reflective";
        platform: (typeof PLATFORMS)[number];
        stylePreset: (typeof STYLE_PRESETS)[number];
        results: ResultItem[];
        favorites: SavedItem[];
        ideaBatches: IdeaBatch[];
        favoriteIdeas: FavoriteIdea[];
        expansionBatches: ExpansionBatch[];
        scriptBoards: ScriptBoardEntry[];
        netflixifyBatches: NetflixifyBatch[];
        carouselLayouts: CarouselLayout[];
        carouselDrafts: CarouselDraft[];
        activeCarouselId: string;
        calendarEntries: CalendarEntry[];
        calendarLayoutVersion?: number;
      }>;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (typeof parsed.targetAudience === "string") setTargetAudience(parsed.targetAudience);
      if (typeof parsed.topicOne === "string") setTopicOne(parsed.topicOne);
      if (typeof parsed.topicTwo === "string") setTopicTwo(parsed.topicTwo);
      if (typeof parsed.showInputSettings === "boolean") setShowInputSettings(parsed.showInputSettings);
      if (parsed.appLanguage === "English" || parsed.appLanguage === "Swedish") setAppLanguage(parsed.appLanguage);
      if (typeof parsed.lighthouseHeadline === "string") setLighthouseHeadline(parsed.lighthouseHeadline);
      const legacyHook = typeof parsed.hook === "string" ? parsed.hook : "";
      const legacyPerspective = typeof parsed.uniquePerspective === "string" ? parsed.uniquePerspective : "";
      if (typeof parsed.topicOneHook === "string") setTopicOneHook(parsed.topicOneHook);
      else if (legacyHook) setTopicOneHook(legacyHook);
      if (typeof parsed.topicTwoHook === "string") setTopicTwoHook(parsed.topicTwoHook);
      else if (legacyHook) setTopicTwoHook(legacyHook);
      if (typeof parsed.topicOnePerspective === "string") setTopicOnePerspective(parsed.topicOnePerspective);
      else if (legacyPerspective) setTopicOnePerspective(legacyPerspective);
      if (typeof parsed.topicTwoPerspective === "string") setTopicTwoPerspective(parsed.topicTwoPerspective);
      else if (legacyPerspective) setTopicTwoPerspective(legacyPerspective);
      if (typeof parsed.curiosityLevel === "number") setCuriosityLevel(Math.max(0, Math.min(1, parsed.curiosityLevel)));
      if (typeof parsed.useContrarianHook === "boolean") setUseContrarianHook(parsed.useContrarianHook);
      if (typeof parsed.useBrandVoiceLock === "boolean") setUseBrandVoiceLock(parsed.useBrandVoiceLock);
      if (typeof parsed.brandVoiceSample === "string") setBrandVoiceSample(parsed.brandVoiceSample);
      if (typeof parsed.netflixConflictLevel === "number") setNetflixConflictLevel(Math.max(0, Math.min(1, parsed.netflixConflictLevel)));
      if (typeof parsed.netflixDramaLevel === "number") setNetflixDramaLevel(Math.max(0, Math.min(1, parsed.netflixDramaLevel)));
      if (
        parsed.netflixEndingStyle === "hopeful" ||
        parsed.netflixEndingStyle === "urgent" ||
        parsed.netflixEndingStyle === "reflective"
      ) {
        setNetflixEndingStyle(parsed.netflixEndingStyle);
      }
      if (parsed.platform && PLATFORMS.includes(parsed.platform)) setPlatform(parsed.platform);
      if (parsed.stylePreset && STYLE_PRESETS.includes(parsed.stylePreset)) setStylePreset(parsed.stylePreset);
      if (Array.isArray(parsed.results)) {
        const normalized = parsed.results.map((item) => ({
          ...item,
          performanceScore:
            typeof item.performanceScore === "number"
              ? Math.max(0, Math.min(100, Math.round(item.performanceScore)))
              : Math.max(0, Math.min(100, Math.round(item.score ?? 0))),
          performanceReason:
            typeof item.performanceReason === "string" && item.performanceReason.trim().length > 0
              ? item.performanceReason
              : "Strong situational relevance and clear emotional payoff can improve retention.",
          improveTip: item.improveTip || "Add a more specific situation detail to make it feel even more real.",
        }));
        setResults(normalized);
      }
      if (Array.isArray(parsed.favorites)) setFavorites(parsed.favorites);
      if (Array.isArray(parsed.ideaBatches)) setIdeaBatches(parsed.ideaBatches);
      if (Array.isArray(parsed.favoriteIdeas)) setFavoriteIdeas(parsed.favoriteIdeas);
      if (Array.isArray(parsed.expansionBatches)) setExpansionBatches(parsed.expansionBatches);
      if (Array.isArray(parsed.scriptBoards)) setScriptBoards(parsed.scriptBoards);
      if (Array.isArray(parsed.netflixifyBatches)) setNetflixifyBatches(parsed.netflixifyBatches);
      if (Array.isArray(parsed.carouselLayouts) && parsed.carouselLayouts.length > 0) {
        setCarouselLayouts(mergeWithDefaultCarouselLayouts(parsed.carouselLayouts));
      }
      if (Array.isArray(parsed.carouselDrafts)) setCarouselDrafts(parsed.carouselDrafts);
      if (typeof parsed.activeCarouselId === "string") setActiveCarouselId(parsed.activeCarouselId);
      if (Array.isArray(parsed.calendarEntries) && parsed.calendarEntries.length > 0) {
        const layoutVer = typeof parsed.calendarLayoutVersion === "number" ? parsed.calendarLayoutVersion : 0;
        const raw = parsed.calendarEntries as CalendarEntry[];
        if (parsed.calendarEntries.length === 28 && layoutVer < CALENDAR_LAYOUT_VERSION) {
          setCalendarEntries(mergeCalendarWithReferenceGrid(raw));
        } else {
          setCalendarEntries(normalizeCalendarEntries(raw));
        }
      }
    } catch {
      // ignore invalid local storage payload
    }
  }, []);

  useEffect(() => {
    const payload = {
      targetAudience,
      topicOne,
      topicTwo,
      showInputSettings,
      appLanguage,
      lighthouseHeadline,
      topicOneHook,
      topicTwoHook,
      topicOnePerspective,
      topicTwoPerspective,
      curiosityLevel,
      useContrarianHook,
      useBrandVoiceLock,
      brandVoiceSample,
      netflixConflictLevel,
      netflixDramaLevel,
      netflixEndingStyle,
      platform,
      stylePreset,
      results,
      favorites,
      ideaBatches,
      favoriteIdeas,
      expansionBatches,
      scriptBoards,
      netflixifyBatches,
      carouselLayouts,
      carouselDrafts,
      activeCarouselId,
      calendarEntries,
      calendarLayoutVersion: CALENDAR_LAYOUT_VERSION,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [
    targetAudience,
    topicOne,
    topicTwo,
    showInputSettings,
    appLanguage,
    lighthouseHeadline,
    topicOneHook,
    topicTwoHook,
    topicOnePerspective,
    topicTwoPerspective,
    curiosityLevel,
    useContrarianHook,
    useBrandVoiceLock,
    brandVoiceSample,
    netflixConflictLevel,
    netflixDramaLevel,
    netflixEndingStyle,
    platform,
    stylePreset,
    results,
    favorites,
    ideaBatches,
    favoriteIdeas,
    expansionBatches,
    scriptBoards,
    netflixifyBatches,
    carouselLayouts,
    carouselDrafts,
    activeCarouselId,
    calendarEntries,
  ]);

  useEffect(() => {
    if (!activeCarouselId && carouselDrafts.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveCarouselId(carouselDrafts[0].id);
    }
  }, [activeCarouselId, carouselDrafts]);

  const onGenerate = useCallback(async () => {
    setError(null);
    setResults([]);
    const apiKey = loadSharedOpenAiKey();
    if (!topicOneHook.trim()) {
      setError("Enter a Topic 1 hook to transform.");
      return;
    }
    setLoading(true);
    setLoadingLabel("Generating...");
    try {
      const hooks = await generateHookVariations({
        apiKey,
        language: appLanguage,
        targetAudience,
        hook: topicOneHook,
        platform,
        stylePreset,
        curiosityLevel,
        useContrarianHook,
        useBrandVoiceLock,
        brandVoiceSample,
        uniquePerspective: topicOnePerspective,
        instructions: hookTransformInstructions,
      });
      setResults(toResultItems(hooks));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [appLanguage, brandVoiceSample, curiosityLevel, topicOneHook, platform, stylePreset, targetAudience, topicOnePerspective, useBrandVoiceLock, useContrarianHook]);

  const onFindTrendingHooks = useCallback(async () => {
    setError(null);
    const apiKey = loadSharedOpenAiKey();
    if (!topicOneHook.trim()) {
      setError("Enter a Topic 1 hook first so I can find matching trend hooks.");
      return;
    }
    setLoading(true);
    setLoadingLabel("Finding trends...");
    try {
      const hooks = await generateTrendingHooks({
        apiKey,
        language: appLanguage,
        targetAudience,
        hook: topicOneHook,
        stylePreset,
        curiosityLevel,
        useContrarianHook,
        useBrandVoiceLock,
        brandVoiceSample,
        uniquePerspective: topicOnePerspective,
      });
      setResults(toResultItems(hooks));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to find trending hooks.");
    } finally {
      setLoading(false);
      setLoadingLabel("Generating...");
    }
  }, [appLanguage, brandVoiceSample, curiosityLevel, topicOneHook, stylePreset, targetAudience, topicOnePerspective, useBrandVoiceLock, useContrarianHook]);

  const addToFavorites = useCallback(
    (item: ResultItem) => {
      const exists = favorites.some((fav) => fav.text.toLowerCase() === item.text.toLowerCase());
      if (exists) return;
      const entry: SavedItem = {
        ...item,
        sourceHook: topicOneHook,
        targetAudience,
        platform,
        stylePreset,
        savedAt: new Date().toISOString(),
      };
      setFavorites((prev) => [entry, ...prev]);
    },
    [favorites, topicOneHook, platform, stylePreset, targetAudience],
  );

  const onRewriteFromWinner = useCallback(
    async (item: ResultItem) => {
      setError(null);
      setRewritingId(item.id);
      const apiKey = loadSharedOpenAiKey();
      try {
        const hooks = await rewriteWinningHook({
          apiKey,
          language: appLanguage,
          targetAudience,
          hook: topicOneHook,
          winningHook: item.text,
          platform,
          stylePreset,
          curiosityLevel,
          useContrarianHook,
          useBrandVoiceLock,
          brandVoiceSample,
          uniquePerspective: topicOnePerspective,
          instructions: hookTransformInstructions,
        });
        setResults(toResultItems(hooks));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to rewrite from winner.");
      } finally {
        setRewritingId(null);
      }
    },
    [appLanguage, brandVoiceSample, curiosityLevel, topicOneHook, platform, stylePreset, targetAudience, topicOnePerspective, useBrandVoiceLock, useContrarianHook],
  );

  const onGenerateIdeas = useCallback(
    async (item: ResultItem) => {
      setError(null);
      setActiveView("aha");
      setIdeasLoadingId(item.id);
      const apiKey = loadSharedOpenAiKey();
      try {
        const ideas = await generateContentIdeas({
          apiKey,
          language: appLanguage,
          targetAudience,
          platform,
          hook: item.text,
          uniquePerspective: topicOnePerspective,
        });
        const nextBatch: IdeaBatch = {
          id: makeId(),
          hookId: item.id,
          hookText: item.text,
          platform,
          targetAudience,
          createdAt: new Date().toISOString(),
          ideas: ideas.map((idea) => ({ id: makeId(), text: idea })),
        };
        setIdeaBatches((prev) => [nextBatch, ...prev]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to generate content ideas.");
      } finally {
        setIdeasLoadingId(null);
      }
    },
    [appLanguage, platform, targetAudience, topicOnePerspective],
  );

  const onExpandWinningHook = useCallback(
    async (item: ResultItem) => {
      setError(null);
      setExpandingId(item.id);
      const apiKey = loadSharedOpenAiKey();
      try {
        const pack = await generateWinningHookExpansion({
          apiKey,
          language: appLanguage,
          targetAudience,
          platform,
          stylePreset,
          uniquePerspective: topicOnePerspective,
          baseHook: item.text,
        });
        const batch: ExpansionBatch = {
          id: makeId(),
          hookText: item.text,
          createdAt: new Date().toISOString(),
          groups: toExpansionGroups(pack),
        };
        setExpansionBatches((prev) => [batch, ...prev]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to expand winning hook.");
      } finally {
        setExpandingId(null);
      }
    },
    [appLanguage, platform, stylePreset, targetAudience, topicOnePerspective],
  );

  const onCreateScriptStoryboard = useCallback(
    async (item: ResultItem) => {
      setError(null);
      setScriptLoadingId(item.id);
      const apiKey = loadSharedOpenAiKey();
      try {
        const pkg = await generateScriptStoryboard({
          apiKey,
          language: appLanguage,
          platform,
          targetAudience,
          useBrandVoiceLock,
          brandVoiceSample,
          uniquePerspective: topicOnePerspective,
          hook: item.text,
        });
        const entry: ScriptBoardEntry = {
          id: makeId(),
          hookText: item.text,
          platform,
          targetAudience,
          createdAt: new Date().toISOString(),
          package: pkg,
        };
        setScriptBoards((prev) => [entry, ...prev]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create script/storyboard.");
      } finally {
        setScriptLoadingId(null);
      }
    },
    [appLanguage, brandVoiceSample, platform, targetAudience, topicOnePerspective, useBrandVoiceLock],
  );

  const onGenerateAhaFromCalendarDay = useCallback(
    async (entry: CalendarEntry) => {
      const hookText = entry.hookText.trim();
      if (!hookText) {
        setError(appLanguage === "Swedish" ? "Lagg till hook-text for den har dagen forst." : "Add hook text for this day first.");
        return;
      }
      setError(null);
      setActiveView("aha");
      setIdeasLoadingId(calendarAhaLoadingKey(entry.id));
      const apiKey = loadSharedOpenAiKey();
      const calendarUsesTopic2 = topicTwo.trim().length > 0 && topicTwoHook.trim().length > 0;
      const useTopic1PerspectiveOnly = entry.topicSlot === "topic1" || !calendarUsesTopic2;
      const dayPerspective = (useTopic1PerspectiveOnly ? topicOnePerspective : topicTwoPerspective).trim();
      try {
        const ideas = await generateContentIdeas({
          apiKey,
          language: appLanguage,
          targetAudience,
          platform,
          hook: hookText,
          uniquePerspective: dayPerspective,
        });
        const nextBatch: IdeaBatch = {
          id: makeId(),
          hookId: entry.id,
          hookText,
          platform,
          targetAudience,
          createdAt: new Date().toISOString(),
          ideas: ideas.map((idea) => ({ id: makeId(), text: idea })),
        };
        setIdeaBatches((prev) => [nextBatch, ...prev]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to generate content ideas.");
      } finally {
        setIdeasLoadingId(null);
      }
    },
    [appLanguage, platform, targetAudience, topicOnePerspective, topicTwoPerspective, topicTwo, topicTwoHook],
  );

  const onGenerateScriptFromCalendarDay = useCallback(
    async (entry: CalendarEntry) => {
      const hookText = entry.hookText.trim();
      if (!hookText) {
        setError(appLanguage === "Swedish" ? "Lagg till hook-text for den har dagen forst." : "Add hook text for this day first.");
        return;
      }
      setError(null);
      setActiveView("script");
      setScriptLoadingId(calendarScriptLoadingKey(entry.id));
      const apiKey = loadSharedOpenAiKey();
      const calendarUsesTopic2 = topicTwo.trim().length > 0 && topicTwoHook.trim().length > 0;
      const useTopic1PerspectiveOnly = entry.topicSlot === "topic1" || !calendarUsesTopic2;
      const dayPerspective = (useTopic1PerspectiveOnly ? topicOnePerspective : topicTwoPerspective).trim();
      try {
        const pkg = await generateScriptStoryboard({
          apiKey,
          language: appLanguage,
          platform,
          targetAudience,
          useBrandVoiceLock,
          brandVoiceSample,
          uniquePerspective: dayPerspective,
          hook: hookText,
        });
        const board: ScriptBoardEntry = {
          id: makeId(),
          hookText,
          platform,
          targetAudience,
          createdAt: new Date().toISOString(),
          package: pkg,
        };
        setScriptBoards((prev) => [board, ...prev]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create script/storyboard.");
      } finally {
        setScriptLoadingId(null);
      }
    },
    [appLanguage, brandVoiceSample, platform, targetAudience, topicOnePerspective, topicTwoPerspective, topicTwo, topicTwoHook, useBrandVoiceLock],
  );

  const onNetflixify = useCallback(
    async (hookText: string, loadingId: string) => {
      setError(null);
      setNetflixifyLoadingId(loadingId);
      setActiveView("script");
      const apiKey = loadSharedOpenAiKey();
      const seedHook = hookText.trim();
      if (!seedHook) {
        setError("Enter a Topic 1 hook first to Netflixify.");
        setNetflixifyLoadingId(null);
        return;
      }
      try {
        const scripts = await generateNetflixifyScripts({
          apiKey,
          language: appLanguage,
          platform,
          targetAudience,
          curiosityLevel,
          useContrarianHook,
          conflictLevel: netflixConflictLevel,
          dramaLevel: netflixDramaLevel,
          endingStyle: netflixEndingStyle,
          useBrandVoiceLock,
          brandVoiceSample,
          uniquePerspective: topicOnePerspective,
          hook: seedHook,
        });
        const batch: NetflixifyBatch = {
          id: makeId(),
          hookText: seedHook,
          platform,
          targetAudience,
          createdAt: new Date().toISOString(),
          scripts,
        };
        setNetflixifyBatches((prev) => [batch, ...prev]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to Netflixify scripts.");
      } finally {
        setNetflixifyLoadingId(null);
      }
    },
    [
      appLanguage,
      brandVoiceSample,
      curiosityLevel,
      netflixConflictLevel,
      netflixDramaLevel,
      netflixEndingStyle,
      platform,
      targetAudience,
      topicOnePerspective,
      useBrandVoiceLock,
      useContrarianHook,
    ],
  );

  const onUpdateHookText = useCallback((id: string, text: string) => {
    setResults((prev) => prev.map((item) => (item.id === id ? { ...item, text } : item)));
  }, []);

  const updateCalendarEntry = useCallback((id: string, patch: Partial<CalendarEntry>) => {
    setCalendarEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }, []);

  const onClearUnlockedCalendarHooks = useCallback(() => {
    setError(null);
    setCalendarEntries((prev) =>
      prev.map((entry) => (entry.locked ? entry : { ...entry, hookText: "" })),
    );
  }, []);

  const onSendHookToCalendar = useCallback(
    (hookText: string, columnLabel: (typeof HOOK_COLUMN_LABELS)[number]) => {
      const trimmed = hookText.trim();
      if (!trimmed) return;
      setError(null);
      const calendarHookType = VARIANT_COLUMN_TO_CALENDAR_HOOK[columnLabel];
      const candidates = calendarEntries.filter(
        (e) => !e.locked && !e.completed && e.hookType === calendarHookType,
      );
      const sorted = [...candidates].sort((a, b) => {
        const aEmpty = !a.hookText.trim();
        const bEmpty = !b.hookText.trim();
        if (aEmpty !== bEmpty) return aEmpty ? -1 : 1;
        if (a.week !== b.week) return a.week - b.week;
        return calendarDaySortIndex(a.day) - calendarDaySortIndex(b.day);
      });
      const pick = sorted[0];
      if (!pick) {
        setError(
          appLanguage === "Swedish"
            ? `Ingen ledig kalenderdag (olast, ej klar) med hook-typ "${calendarHookType}". Las upp en dag eller matcha hook-typen.`
            : `No unlocked, active calendar day uses "${calendarHookType}". Unlock a day or set its hook type to match this column.`,
        );
        return;
      }
      updateCalendarEntry(pick.id, { hookText: trimmed });
    },
    [appLanguage, calendarEntries, updateCalendarEntry],
  );

  const onFillCalendar = useCallback(async () => {
    setError(null);
    const apiKey = loadSharedOpenAiKey();
    const unlocked = calendarEntries.filter((entry) => !entry.locked && !entry.completed);
    if (unlocked.length === 0) {
      setError(
        appLanguage === "Swedish"
          ? "Alla dagar ar lasta eller markerade som klara. Las upp eller avmarkera Klar pa minst en dag."
          : "All days are locked or marked done. Unlock or clear Done on at least one day to regenerate.",
      );
      setActiveView("calendar");
      return;
    }
    const topicOneValue = topicOne.trim();
    if (!topicOneValue) {
      setError(
        appLanguage === "Swedish" ? "Ange Amne 1 under Installningar forst." : "Set Topic 1 in Settings first.",
      );
      return;
    }
    const topicOneHookValue = topicOneHook.trim();
    if (!topicOneHookValue) {
      setError(
        appLanguage === "Swedish"
          ? "Fyll i hook for Amne 1 ovan."
          : "Add the Topic 1 seed hook above.",
      );
      return;
    }
    const topicTwoValue = topicTwo.trim();
    const topicTwoHookValue = topicTwoHook.trim();
    const calendarUsesTopic2 = topicTwoValue.length > 0 && topicTwoHookValue.length > 0;
    setLoading(true);
    setLoadingLabel("Filling calendar...");
    setActiveView("calendar");
    try {
      const dayInputs: CalendarHookDayInput[] = unlocked.map((entry) => {
        const useTopic1Only = entry.topicSlot === "topic1" || !calendarUsesTopic2;
        return {
          id: entry.id,
          weekLabel: `Week ${entry.week}`,
          dayLabel: entry.day,
          topic: useTopic1Only ? topicOneValue : topicTwoValue,
          seedHook: useTopic1Only ? topicOneHookValue : topicTwoHookValue,
          uniquePerspective: (useTopic1Only ? topicOnePerspective : topicTwoPerspective).trim(),
          hookType: entry.hookType,
          format: entry.format,
        };
      });
      const generated = await generateCalendarHooks({
        apiKey,
        language: appLanguage,
        targetAudience,
        curiosityLevel,
        useContrarianHook,
        useBrandVoiceLock,
        brandVoiceSample,
        days: dayInputs,
      });
      const byId = new Map(generated.map((row) => [row.id, row.hook]));
      setCalendarEntries((prev) =>
        prev.map((entry) =>
          entry.locked || entry.completed ? entry : { ...entry, hookText: byId.get(entry.id) ?? entry.hookText },
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fill calendar.");
    } finally {
      setLoading(false);
      setLoadingLabel("Generating...");
    }
  }, [
    appLanguage,
    brandVoiceSample,
    calendarEntries,
    curiosityLevel,
    targetAudience,
    topicOne,
    topicTwo,
    topicOneHook,
    topicTwoHook,
    topicOnePerspective,
    topicTwoPerspective,
    useBrandVoiceLock,
    useContrarianHook,
  ]);

  const onFindRedditTopics = useCallback(async () => {
    setError(null);
    const t1 = topicOneHook.trim();
    const t2 = topicTwoHook.trim();
    if (!t1 && !t2) {
      setError(
        appLanguage === "Swedish"
          ? "Skriv minst en hook i Amne 1 eller Amne 2 forst."
          : "Enter at least one hook in Topic 1 or Topic 2 first.",
      );
      return;
    }
    const apiKey = loadSharedOpenAiKey();
    if (!apiKey.trim()) {
      setError(
        appLanguage === "Swedish"
          ? "Lagg till OpenAI-nyckel i SaaS Apps (kugghjulsikonen) forst."
          : "Add your OpenAI API key in the SaaS Apps hub (gear icon) first.",
      );
      return;
    }
    setRedditTopicsLoading(true);
    setActiveView("reddit");
    try {
      const posts = await generateRedditStyleTopicsFromHooks({
        apiKey,
        language: appLanguage,
        topicOneHook,
        topicTwoHook,
      });
      setRedditTopicPosts(posts);
    } catch (e) {
      setRedditTopicPosts([]);
      setError(
        e instanceof Error ? e.message : appLanguage === "Swedish" ? "Kunde inte skapa amnen." : "Could not generate topic ideas.",
      );
    } finally {
      setRedditTopicsLoading(false);
    }
  }, [appLanguage, topicOneHook, topicTwoHook]);

  const createCarouselDraft = useCallback(() => {
    const primaryLayoutId = carouselLayouts[0]?.id ?? "layout-minimal";
    const draft: CarouselDraft = {
      id: makeId(),
      name: `Carousel ${carouselDrafts.length + 1}`,
      createdAt: new Date().toISOString(),
      slides: [
        {
          id: makeId(),
          headline: "Slide headline",
          body: "Add your message here.",
          layoutId: primaryLayoutId,
          textAlign: "left",
          tone: "soft",
          headlineSize: 72,
          bodySize: 38,
        },
      ],
    };
    setCarouselDrafts((prev) => [draft, ...prev]);
    setActiveCarouselId(draft.id);
  }, [carouselDrafts.length, carouselLayouts]);

  const addCarouselSlide = useCallback(
    (draftId: string) => {
      const primaryLayoutId = carouselLayouts[0]?.id ?? "layout-minimal";
      setCarouselDrafts((prev) =>
        prev.map((draft) =>
          draft.id === draftId
            ? {
                ...draft,
                slides: [
                  ...draft.slides,
                  {
                    id: makeId(),
                    headline: `Slide ${draft.slides.length + 1}`,
                    body: "",
                    layoutId: primaryLayoutId,
                    textAlign: "left",
                    tone: "soft",
                    headlineSize: 72,
                    bodySize: 38,
                  },
                ],
              }
            : draft,
        ),
      );
    },
    [carouselLayouts],
  );

  const updateCarouselSlide = useCallback((draftId: string, slideId: string, patch: Partial<CarouselSlide>) => {
    setCarouselDrafts((prev) =>
      prev.map((draft) =>
        draft.id === draftId
          ? {
              ...draft,
              slides: draft.slides.map((slide) => (slide.id === slideId ? { ...slide, ...patch } : slide)),
            }
          : draft,
      ),
    );
  }, []);

  const updateCarouselDraftName = useCallback((draftId: string, name: string) => {
    setCarouselDrafts((prev) => prev.map((draft) => (draft.id === draftId ? { ...draft, name } : draft)));
  }, []);

  const updateCarouselLayout = useCallback((layoutId: string, patch: Partial<CarouselLayout>) => {
    setCarouselLayouts((prev) => prev.map((layout) => (layout.id === layoutId ? { ...layout, ...patch } : layout)));
  }, []);

  const applyReferencePreset = useCallback((draftId: string) => {
    setCarouselDrafts((prev) =>
      prev.map((draft) => {
        if (draft.id !== draftId || draft.slides.length === 0) return draft;
        return {
          ...draft,
          slides: draft.slides.map((slide, idx) =>
            idx === 0
              ? {
                  ...slide,
                  layoutId: "layout-minimal",
                  textAlign: "left",
                  tone: "soft",
                  headlineSize: REFERENCE_CAROUSEL.headlineSize,
                  bodySize: REFERENCE_CAROUSEL.bodySize,
                }
              : slide,
          ),
        };
      }),
    );
  }, []);

  const onDesignCarouselFromText = useCallback(
    (sourceText: string, namePrefix: string) => {
      const baseText = sourceText.trim();
      if (!baseText) return;
      const primaryLayoutId = carouselLayouts[0]?.id ?? "layout-minimal";
      const isCarouselPlatform = platform.toLowerCase().includes("carousel");
      const draft: CarouselDraft = {
        id: makeId(),
        name: `${namePrefix} ${new Date().toLocaleTimeString()}`,
        createdAt: new Date().toISOString(),
        slides: isCarouselPlatform
          ? buildHeadlineSubheadlineSlidesFromText(baseText, primaryLayoutId)
          : buildSlidesFromText(baseText, primaryLayoutId),
      };
      setCarouselDrafts((prev) => [draft, ...prev]);
      setActiveCarouselId(draft.id);
      setActiveView("carousel");
    },
    [carouselLayouts, platform],
  );

  const hookColumns = useMemo(() => {
    return HOOK_COLUMN_LABELS.map((label) => ({
      label,
      items: results.filter((item) => (item.source ?? "").toLowerCase() === label.toLowerCase()),
    }));
  }, [results]);
  const activeCarouselDraft = useMemo(
    () => carouselDrafts.find((draft) => draft.id === activeCarouselId) ?? carouselDrafts[0],
    [activeCarouselId, carouselDrafts],
  );

  useEffect(() => {
    const id = activeCarouselId;
    const n = activeCarouselDraft?.slides.length ?? 0;
    if (prevActiveCarouselIdRef.current !== id) {
      prevActiveCarouselIdRef.current = id;
      setCarouselStudioSlideIdx(0);
    } else if (n > 0) {
      setCarouselStudioSlideIdx((i) => Math.min(Math.max(0, i), n - 1));
    }
  }, [activeCarouselId, activeCarouselDraft?.slides.length, activeCarouselDraft?.id]);

  const isIdeaFavorited = useCallback(
    (idea: IdeaItem, batch: IdeaBatch) =>
      favoriteIdeas.some(
        (fav) =>
          fav.text.toLowerCase() === idea.text.toLowerCase() &&
          fav.hookText.toLowerCase() === batch.hookText.toLowerCase(),
      ),
    [favoriteIdeas],
  );

  const saveIdeaToFavorites = useCallback((idea: IdeaItem, batch: IdeaBatch) => {
    setFavoriteIdeas((prev) => {
      const exists = prev.some(
        (fav) =>
          fav.text.toLowerCase() === idea.text.toLowerCase() &&
          fav.hookText.toLowerCase() === batch.hookText.toLowerCase(),
      );
      if (exists) return prev;
      return [
        {
          id: makeId(),
          text: idea.text,
          hookText: batch.hookText,
          platform: batch.platform,
          targetAudience: batch.targetAudience,
          savedAt: new Date().toISOString(),
        },
        ...prev,
      ];
    });
  }, []);

  return (
    <div className="h-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <header
        className="sticky top-0 z-30 border-b px-4 py-4 sm:px-6"
        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-secondary)" }}
      >
        <div className="grid w-full grid-cols-[1fr_minmax(0,1fr)_1fr] items-center gap-3">
          <div />
          <div className="flex justify-center">
            <input
              value={lighthouseHeadline}
              onChange={(e) => setLighthouseHeadline(e.target.value)}
              className="w-full border-none bg-transparent text-center text-2xl font-semibold leading-tight outline-none sm:text-3xl"
              style={{ color: "var(--text-primary)" }}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <select
              value={appLanguage}
              onChange={(e) => setAppLanguage(e.target.value as AppLanguage)}
              className="rounded-xl border px-3 py-2 text-sm"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--bg-elevated)",
                color: "var(--text-secondary)",
              }}
              aria-label="Language"
            >
              <option value="English">English</option>
              <option value="Swedish">Svenska</option>
            </select>
            <a
              href=".."
              className="rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--bg-elevated)",
                color: "var(--text-secondary)",
              }}
            >
              SaaS Apps
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="grid h-[calc(100vh-86px)] w-full min-w-0 gap-3 overflow-hidden p-2 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside
          className="h-full overflow-y-auto rounded-2xl border p-3"
          style={{
            borderColor: "var(--border-subtle)",
            background: "var(--bg-elevated)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{appLanguage === "Swedish" ? "Inmatning" : "Inputs"}</h2>
          <button
            type="button"
            onClick={() => setShowInputSettings((prev) => !prev)}
            className="w-full rounded-xl border px-4 py-2.5 text-left text-sm font-semibold transition-colors"
            style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
          >
            {showInputSettings ? "Hide settings" : "Settings"}
          </button>
          {showInputSettings ? (
            <div className="mt-2 rounded-xl border p-2.5" style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)" }}>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Topic 1</span>
                <input
                  value={topicOne}
                  onChange={(e) => setTopicOne(e.target.value)}
                  className="w-full rounded-lg border px-2.5 py-2 text-xs outline-none"
                  style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)", color: "var(--text-primary)" }}
                />
              </label>
              <label className="mt-2 block">
                <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Topic 2</span>
                <input
                  value={topicTwo}
                  onChange={(e) => setTopicTwo(e.target.value)}
                  className="w-full rounded-lg border px-2.5 py-2 text-xs outline-none"
                  style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)", color: "var(--text-primary)" }}
                />
              </label>
              <label className="mt-2 block">
                <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Target audience</span>
                <textarea
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  rows={3}
                  className="w-full resize-y rounded-lg border px-2.5 py-2 text-xs outline-none"
                  style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)", color: "var(--text-primary)" }}
                />
              </label>
            </div>
          ) : null}
          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              {appLanguage === "Swedish" ? "Hook · Amne 1 (Topic 1)" : "Hook · Topic 1"}
            </span>
            <textarea
              value={topicOneHook}
              onChange={(e) => setTopicOneHook(e.target.value)}
              rows={3}
              placeholder="Can't switch off your thoughts?"
              className="w-full resize-y rounded-xl border px-3 py-2.5 text-sm outline-none transition-shadow focus:ring-2"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
              }}
            />
          </label>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              {appLanguage === "Swedish" ? "Hook · Amne 2 (Topic 2)" : "Hook · Topic 2"}
            </span>
            <textarea
              value={topicTwoHook}
              onChange={(e) => setTopicTwoHook(e.target.value)}
              rows={3}
              placeholder={appLanguage === "Swedish" ? "Andra amnets vinkel…" : "Second topic angle…"}
              className="w-full resize-y rounded-xl border px-3 py-2.5 text-sm outline-none transition-shadow focus:ring-2"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
              }}
            />
          </label>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              {appLanguage === "Swedish" ? "Unikt perspektiv · Amne 1" : "Unique perspective · Topic 1"}
            </span>
            <textarea
              value={topicOnePerspective}
              onChange={(e) => setTopicOnePerspective(e.target.value)}
              rows={2}
              placeholder={appLanguage === "Swedish" ? "Valfritt vinkel for amne 1" : "Optional angle for topic 1"}
              className="w-full resize-y rounded-xl border px-3 py-2.5 text-sm outline-none transition-shadow focus:ring-2"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
              }}
            />
          </label>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              {appLanguage === "Swedish" ? "Unikt perspektiv · Amne 2" : "Unique perspective · Topic 2"}
            </span>
            <textarea
              value={topicTwoPerspective}
              onChange={(e) => setTopicTwoPerspective(e.target.value)}
              rows={2}
              placeholder={appLanguage === "Swedish" ? "Valfritt vinkel for amne 2" : "Optional angle for topic 2"}
              className="w-full resize-y rounded-xl border px-3 py-2.5 text-sm outline-none transition-shadow focus:ring-2"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
              }}
            />
          </label>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              {appLanguage === "Swedish" ? "Nyfikenhetsniva" : "Curiosity level"}: {curiosityLevel.toFixed(2)}
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={curiosityLevel}
              onChange={(e) => setCuriosityLevel(Number(e.target.value))}
              className="w-full"
            />
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={useContrarianHook}
              onChange={(e) => setUseContrarianHook(e.target.checked)}
            />
            {appLanguage === "Swedish" ? "Anvand kontrarian hook" : "Use contrarian hook"}
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={useBrandVoiceLock}
              onChange={(e) => setUseBrandVoiceLock(e.target.checked)}
            />
            {appLanguage === "Swedish" ? "Las varumarkesrost" : "Brand voice lock"}
          </label>
          {useBrandVoiceLock ? (
            <label className="mt-2 block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">{appLanguage === "Swedish" ? "Exempel pa varumarkesrost" : "Brand voice sample"}</span>
              <textarea
                value={brandVoiceSample}
                onChange={(e) => setBrandVoiceSample(e.target.value)}
                rows={4}
                placeholder="Paste examples of your brand tone. The generator will try to match this voice."
                className="w-full resize-y rounded-xl border px-3 py-2.5 text-sm outline-none transition-shadow focus:ring-2"
                style={{
                  borderColor: "var(--border-default)",
                  background: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                }}
              />
            </label>
          ) : null}
          <div className="mt-3 rounded-xl border p-2.5" style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)" }}>
            <p className="text-sm font-medium text-[var(--text-secondary)]">{appLanguage === "Swedish" ? "Netflixify-kontroller" : "Netflixify controls"}</p>
            <label className="mt-2 block">
              <span className="mb-1 block text-xs text-[var(--text-secondary)]">Conflict: {netflixConflictLevel.toFixed(2)}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={netflixConflictLevel}
                onChange={(e) => setNetflixConflictLevel(Number(e.target.value))}
                className="w-full"
              />
            </label>
            <label className="mt-2 block">
              <span className="mb-1 block text-xs text-[var(--text-secondary)]">Drama: {netflixDramaLevel.toFixed(2)}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={netflixDramaLevel}
                onChange={(e) => setNetflixDramaLevel(Number(e.target.value))}
                className="w-full"
              />
            </label>
            <label className="mt-2 block">
              <span className="mb-1 block text-xs text-[var(--text-secondary)]">Ending style</span>
              <select
                value={netflixEndingStyle}
                onChange={(e) => setNetflixEndingStyle(e.target.value as "hopeful" | "urgent" | "reflective")}
                className="w-full rounded-lg border px-2 py-2 text-xs"
                style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)", color: "var(--text-primary)" }}
              >
                <option value="reflective">Reflective</option>
                <option value="hopeful">Hopeful</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onGenerate}
            className="mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: "var(--accent-gradient)", boxShadow: "var(--shadow-sm)" }}
          >
            {loading ? loadingLabel : appLanguage === "Swedish" ? "Generera 15 hooks" : "Generate 15 hooks"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void onFillCalendar()}
            className="mt-2.5 w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderColor: "var(--border-default)",
              background: "var(--bg-tertiary)",
              color: "var(--text-secondary)",
            }}
          >
            {loading && loadingLabel === "Filling calendar..." ? "Filling..." : "Fill the calendar"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void onFindTrendingHooks()}
            className="mt-2.5 w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderColor: "var(--border-default)",
              background: "var(--bg-tertiary)",
              color: "var(--text-secondary)",
            }}
          >
            {loading && loadingLabel === "Finding trends..." ? (appLanguage === "Swedish" ? "Hittar trender..." : "Finding trends...") : appLanguage === "Swedish" ? "Hitta trendande hooks" : "Find trending hooks"}
          </button>
          <button
            type="button"
            disabled={netflixifyLoadingId === "input-hook"}
            onClick={() => void onNetflixify(topicOneHook, "input-hook")}
            className="mt-2.5 w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderColor: "var(--border-default)",
              background: "var(--bg-tertiary)",
              color: "var(--text-secondary)",
            }}
          >
            {netflixifyLoadingId === "input-hook" ? (appLanguage === "Swedish" ? "Netflixifierar..." : "Netflixifying...") : "Netflixify"}
          </button>
          <button
            type="button"
            disabled={redditTopicsLoading}
            onClick={() => void onFindRedditTopics()}
            className="mt-2.5 w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderColor: "var(--border-default)",
              background: "var(--bg-tertiary)",
              color: "var(--text-secondary)",
            }}
          >
            {redditTopicsLoading
              ? appLanguage === "Swedish"
                ? "Skapar forslag..."
                : "Generating ideas..."
              : appLanguage === "Swedish"
                ? "Hitta Reddit-amnen"
                : "Find Reddit Topics"}
          </button>
          <p className="mt-2.5 text-xs leading-relaxed text-[var(--text-tertiary)]">
            Uses your shared OpenAI key from the hub (local <code className="rounded bg-[var(--bg-hover)] px-1">saasApiKeys</code>). Add
            it via the gear icon on the SaaS Apps page if needed.
          </p>
          {error ? (
            <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>
          ) : null}
        </aside>

        <section className="h-full min-w-0 overflow-y-auto pr-1 text-base">
          <nav
            className="sticky top-0 z-20 mb-3 flex flex-wrap items-end gap-0 border-b px-0 pt-1"
            style={{ borderColor: "var(--border-default)", background: "var(--bg-primary)" }}
            aria-label={appLanguage === "Swedish" ? "Vyflikar" : "Main views"}
          >
            {VIEWS.map((view) => {
              const label = mainViewTabLabel(view, appLanguage);
              const isActive = activeView === view;
              return (
                <button
                  key={view}
                  type="button"
                  onClick={() => setActiveView(view)}
                  role="tab"
                  aria-selected={isActive}
                  className={
                    isActive
                      ? "relative z-10 -mb-px rounded-t-lg border border-b-0 px-3 py-2 text-sm font-semibold transition-colors"
                      : "rounded-t-lg border border-transparent px-3 py-2 text-sm font-medium transition-colors hover:border-[var(--border-subtle)] hover:bg-[var(--bg-tertiary)]"
                  }
                  style={
                    isActive
                      ? {
                          borderColor: "var(--border-default)",
                          borderBottomColor: "var(--bg-primary)",
                          background: "var(--bg-primary)",
                          color: "var(--text-primary)",
                          boxShadow: "0 1px 0 0 var(--bg-primary)",
                        }
                      : {
                          color: "var(--text-secondary)",
                        }
                  }
                >
                  {label}
                </button>
              );
            })}
          </nav>

          {activeView === "variants" ? (
            <>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                {appLanguage === "Swedish" ? "Hookvarianter" : "Hook Variants"}
              </h2>
              {results.length === 0 && !loading ? (
                <div
                  className="rounded-2xl border border-dashed p-8 text-center text-sm text-[var(--text-tertiary)]"
                  style={{ borderColor: "var(--border-default)", background: "var(--bg-secondary)" }}
                >
                  Generated hooks appear here. Instructions live in{" "}
                  <code className="rounded bg-[var(--bg-hover)] px-1 text-[var(--text-secondary)]">src/data/hook-transform-instructions.json</code>.
                </div>
              ) : null}
              {loading ? (
                <div className="grid gap-2 xl:grid-cols-3 2xl:grid-cols-5">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-20 animate-pulse rounded-2xl border"
                      style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}
                    />
                  ))}
                </div>
              ) : null}
              {!loading && results.length > 0 ? (
                <div className="grid gap-3 xl:grid-cols-3 2xl:grid-cols-5">
                  {hookColumns.map((column) => (
                    <section
                      key={column.label}
                      className="rounded-xl border p-2"
                      style={{
                        borderColor: "var(--border-subtle)",
                        background: "var(--bg-elevated)",
                        boxShadow: "var(--shadow-sm)",
                      }}
                    >
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-primary)]">{column.label}</h3>
                      <ul className="list-none space-y-2 p-0">
                        {column.items.map((item, i) => (
                          <li key={item.id} className="rounded-lg border p-2" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-secondary)" }}>
                            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">#{i + 1}</span>
                            <textarea
                              value={item.text}
                              onChange={(e) => onUpdateHookText(item.id, e.target.value)}
                              rows={3}
                              className="flex-1 w-full resize-y px-0.5 py-0.5 text-base font-medium leading-snug outline-none"
                              style={{
                                color: "var(--text-secondary)",
                              }}
                            />
                            <div className="mt-1.5 flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="rounded-md border px-2 py-0.5 text-xs font-medium transition-colors"
                          style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                          title="Copy hook"
                          aria-label="Copy hook"
                          onClick={() => {
                            void navigator.clipboard.writeText(item.text);
                          }}
                        >
                          📋
                        </button>
                        <button
                          type="button"
                          className="rounded-md border px-2 py-0.5 text-xs font-medium transition-colors"
                          style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                          title="Save hook to favorites"
                          aria-label="Save hook to favorites"
                          onClick={() => addToFavorites(item)}
                        >
                          ⭐
                        </button>
                        <button
                          type="button"
                          disabled={rewritingId === item.id}
                          className="rounded-md border px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-60"
                          style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                          title="Rewrite from this winning hook"
                          aria-label="Rewrite from this winning hook"
                          onClick={() => void onRewriteFromWinner(item)}
                        >
                          {rewritingId === item.id ? "⏳" : "🔁"}
                        </button>
                        <button
                          type="button"
                          disabled={ideasLoadingId === item.id}
                          className="rounded-md border px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-60"
                          style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                          title="Generate 5 aha and conclusion examples"
                          aria-label="Generate 5 aha and conclusion examples"
                          onClick={() => void onGenerateIdeas(item)}
                        >
                          {ideasLoadingId === item.id ? "⏳" : "💡"}
                        </button>
                        <button
                          type="button"
                          disabled={expandingId === item.id}
                          className="rounded-md border px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-60"
                          style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                          title="Generate winning hook expansion sets"
                          aria-label="Generate winning hook expansion sets"
                          onClick={() => void onExpandWinningHook(item)}
                        >
                          {expandingId === item.id ? "⏳" : "🚀"}
                        </button>
                        <button
                          type="button"
                          disabled={scriptLoadingId === item.id}
                          className="rounded-md border px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-60"
                          style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                          title="Create script and storyboard from hook"
                          aria-label="Create script and storyboard from hook"
                          onClick={() => void onCreateScriptStoryboard(item)}
                        >
                          {scriptLoadingId === item.id ? "⏳" : "🎬"}
                        </button>
                        <button
                          type="button"
                          disabled={netflixifyLoadingId === item.id}
                          className="rounded-md border px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-60"
                          style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                          title="Netflixify this hook into 5 script ideas"
                          aria-label="Netflixify this hook into 5 script ideas"
                          onClick={() => void onNetflixify(item.text, item.id)}
                        >
                          {netflixifyLoadingId === item.id ? "⏳" : "🍿"}
                        </button>
                        <button
                          type="button"
                          disabled={!item.text.trim()}
                          className="rounded-md border px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-40"
                          style={{
                            borderColor: "var(--border-default)",
                            background: "color-mix(in srgb, var(--bg-tertiary) 72%, rgb(45, 212, 191) 28%)",
                            color: "var(--text-secondary)",
                          }}
                          title={appLanguage === "Swedish" ? "Skicka till kalender" : "Send to calendar"}
                          aria-label={
                            appLanguage === "Swedish" ? "Skicka hook till matchande kalenderdag" : "Send hook to matching calendar day"
                          }
                          onClick={() => onSendHookToCalendar(item.text, column.label)}
                        >
                          📅
                        </button>
                        <button
                          type="button"
                          className="rounded-md border px-2 py-0.5 text-xs font-medium transition-colors"
                          style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                          title="Design carousel from this hook"
                          aria-label="Design carousel from this hook"
                          onClick={() => onDesignCarouselFromText(item.text, "Hook carousel")}
                        >
                          Design carousel
                        </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                      {column.items.length === 0 ? (
                        <p className="text-xs text-[var(--text-tertiary)]">No hooks yet in this column.</p>
                      ) : null}
                    </section>
                  ))}
                </div>
              ) : null}

              <section className="mt-4 rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}>
                <h3 className="text-sm font-semibold">Favorites ({favorites.length})</h3>
                <div className="mt-2 max-h-48 space-y-2 overflow-auto text-xs text-[var(--text-secondary)]">
                  {favorites.length === 0 ? <p className="text-[var(--text-tertiary)]">No favorites yet.</p> : null}
                  {favorites.map((item) => (
                    <p key={item.id}>{item.text}</p>
                  ))}
                </div>
              </section>
            </>
          ) : null}

          {activeView === "aha" ? (
            <>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{appLanguage === "Swedish" ? "Aha + slutsats" : "Aha + conclusion"}</h2>
              <p className="mt-2 text-sm text-[var(--text-tertiary)]">
                Click <span className="font-medium text-[var(--text-secondary)]">💡</span> on any hook to load 5 aha + conclusion examples here.
              </p>

              <div className="mt-4 rounded-xl border p-3" style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)" }}>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Favorite ideas ({favoriteIdeas.length})</h3>
                <div className="mt-2 space-y-2">
                  {favoriteIdeas.length === 0 ? (
                    <p className="text-sm text-[var(--text-tertiary)]">No favorite ideas saved yet.</p>
                  ) : (
                    favoriteIdeas.map((idea) => (
                      <div key={idea.id} className="rounded-lg border p-2 text-sm" style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)" }}>
                        <p className="text-[var(--text-secondary)]">{idea.text}</p>
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">{idea.platform} · {idea.hookText}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-3 pr-1">
                {ideaBatches.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-4 text-sm text-[var(--text-tertiary)]" style={{ borderColor: "var(--border-default)" }}>
                    Aha + conclusion examples appear here in separate cards so you can favorite each one.
                  </div>
                ) : (
                  ideaBatches.map((batch) => (
                    <section key={batch.id} className="rounded-xl border p-3" style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)" }}>
                      <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
                        {batch.platform} · {batch.targetAudience}
                      </p>
                      <p className="mt-1 text-sm font-medium text-[var(--text-secondary)]">{batch.hookText}</p>
                      <div className="mt-2 space-y-2">
                        {batch.ideas.map((idea) => {
                          const saved = isIdeaFavorited(idea, batch);
                          return (
                            <div key={idea.id} className="rounded-lg border p-2 text-sm" style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)" }}>
                              <p className="leading-relaxed text-[var(--text-secondary)]">{idea.text}</p>
                              <div className="mt-2 flex gap-2">
                                <button
                                  type="button"
                                  className="rounded-md border px-2 py-1 text-[11px]"
                                  style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                                  onClick={() => {
                                    void navigator.clipboard.writeText(idea.text);
                                  }}
                                >
                                  Copy
                                </button>
                                <button
                                  type="button"
                                  disabled={saved}
                                  className="rounded-md border px-2 py-1 text-[11px] disabled:opacity-60"
                                  style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                                  onClick={() => saveIdeaToFavorites(idea, batch)}
                                >
                                  {saved ? "Saved" : "Save idea"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))
                )}
              </div>
            </>
          ) : null}

          {activeView === "script" ? (
            <>
              <h2 className="text-base font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{appLanguage === "Swedish" ? "Manus" : "Script"}</h2>
              <div className="mt-4 rounded-xl border p-3" style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)" }}>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Netflixified scripts ({netflixifyBatches.length})</h3>
                <div className="mt-2 space-y-3">
                  {netflixifyBatches.length === 0 ? (
                    <p className="text-sm text-[var(--text-tertiary)]">
                      Click <span className="font-medium text-[var(--text-secondary)]">Netflixify</span> from the left panel or any hook to generate 5 script ideas.
                    </p>
                  ) : (
                    netflixifyBatches.map((batch) => (
                      <div key={batch.id} className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)" }}>
                        <p className="font-semibold text-[var(--text-secondary)]">{batch.platform} · {batch.targetAudience}</p>
                        <p className="mt-1 text-sm text-[var(--text-tertiary)]">Hook: {batch.hookText}</p>
                        <div className="mt-2 space-y-2">
                          {batch.scripts.map((item, idx) => (
                            <div key={`${batch.id}-netflix-script-${idx}`} className="rounded-lg border p-3" style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)" }}>
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-base font-semibold text-[var(--text-secondary)]">{idx + 1}. {item.title}</p>
                                <button
                                  type="button"
                                  className="rounded-md border px-2 py-1 text-xs"
                                  style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
                                  onClick={() => onDesignCarouselFromText(`${item.title}. ${item.script}`, "Script carousel")}
                                >
                                  Generate a carousel
                                </button>
                              </div>
                              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{item.script}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="mt-4 rounded-xl border p-3" style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)" }}>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Scripts & storyboards ({scriptBoards.length})</h3>
                <div className="mt-2 space-y-3">
                  {scriptBoards.length === 0 ? (
                    <p className="text-sm text-[var(--text-tertiary)]">Run the 1-click script/storyboard action on any hook to create a ready-to-record plan.</p>
                  ) : (
                    scriptBoards.map((entry) => (
                      <div key={entry.id} className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)" }}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-base font-semibold text-[var(--text-secondary)]">{entry.package.title}</p>
                          <button
                            type="button"
                            className="rounded-md border px-2 py-1 text-xs"
                            style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                            onClick={() => onDesignCarouselFromText(`${entry.package.title}. ${entry.package.script}`, "Storyboard carousel")}
                          >
                            Generate a carousel
                          </button>
                        </div>
                        <p className="mt-1 text-sm text-[var(--text-tertiary)]">{entry.platform} · {entry.hookText}</p>
                        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{entry.package.script}</p>
                        <div className="mt-2">
                          <p className="font-semibold text-[var(--text-secondary)]">Storyboard</p>
                          <ul className="list-disc pl-5 text-sm text-[var(--text-tertiary)]">
                            {entry.package.storyboard.map((step, idx) => (
                              <li key={`${entry.id}-step-${idx}`}>{step}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="mt-2">
                          <p className="font-semibold text-[var(--text-secondary)]">CTA options</p>
                          <ul className="list-disc pl-5 text-sm text-[var(--text-tertiary)]">
                            {entry.package.ctaOptions.map((cta, idx) => (
                              <li key={`${entry.id}-cta-${idx}`}>{cta}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : null}

          {activeView === "carousel" ? (
            <>
              <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
                    {appLanguage === "Swedish" ? "Karusellstudio" : "Carousel studio"}
                  </h2>
                  <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-[var(--text-tertiary)]">
                    {appLanguage === "Swedish"
                      ? "Redigera text i sidopanelen eller direkt i canvas. 1080 x 1440 for Instagram-karuseller."
                      : "Edit copy in the side panel or directly on the canvas. 1080×1440 for Instagram carousels."}
                  </p>
                </div>
              </header>

              <div className="mt-5 grid min-h-0 gap-5 xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)]">
                <aside className="flex min-h-0 flex-col gap-4">
                  <div
                    className="flex max-h-[40vh] flex-col overflow-hidden rounded-2xl border shadow-[var(--shadow-sm)]"
                    style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)" }}
                  >
                    <div
                      className="flex shrink-0 items-center justify-between border-b px-4 py-3"
                      style={{ borderColor: "var(--border-subtle)", background: "var(--bg-secondary)" }}
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                        {appLanguage === "Swedish" ? "Projekt" : "Projects"} · {carouselDrafts.length}
                      </span>
                      <button
                        type="button"
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                        style={{ background: "var(--accent-gradient)" }}
                        onClick={createCarouselDraft}
                      >
                        {appLanguage === "Swedish" ? "+ Ny" : "+ New"}
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                      {carouselDrafts.length === 0 ? (
                        <div
                          className="rounded-xl border border-dashed px-3 py-6 text-center text-xs leading-relaxed"
                          style={{ borderColor: "var(--border-default)", color: "var(--text-tertiary)" }}
                        >
                          {appLanguage === "Swedish"
                            ? "Skapa en karusell for att borja. Lagg till slides och finjustera layout."
                            : "Create a carousel to get started. Add slides and refine the layout."}
                        </div>
                      ) : (
                        carouselDrafts.map((draft) => {
                          const active = activeCarouselDraft?.id === draft.id;
                          return (
                            <button
                              key={draft.id}
                              type="button"
                              onClick={() => setActiveCarouselId(draft.id)}
                              className="w-full rounded-xl border px-3 py-2.5 text-left transition-[box-shadow,transform] hover:translate-y-[-1px]"
                              style={{
                                borderColor: active ? "var(--accent)" : "var(--border-default)",
                                background: active ? "var(--bg-tertiary)" : "var(--bg-secondary)",
                                boxShadow: active ? "0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent)" : undefined,
                              }}
                            >
                              <p className="text-sm font-semibold text-[var(--text-primary)]">{draft.name}</p>
                              <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                                {draft.slides.length} slides
                              </p>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {activeCarouselDraft ? (
                    <div
                      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border shadow-[var(--shadow-sm)]"
                      style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)", maxHeight: "min(52vh, 640px)" }}
                    >
                      <div
                        className="shrink-0 border-b px-4 py-3"
                        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-secondary)" }}
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                          {appLanguage === "Swedish" ? "Slide-innehall" : "Slide content"}
                        </p>
                        <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                          {appLanguage === "Swedish" ? "Klicka pa en slide nedan for att visa den i canvas." : "Click a slide below to show it on the canvas."}
                        </p>
                      </div>
                      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                        {activeCarouselDraft.slides.map((slide, idx) => {
                          const isStudioSlide = idx === carouselStudioSlideIdx;
                          return (
                            <div
                              key={`${activeCarouselDraft.id}-editor-${slide.id}`}
                              role="button"
                              tabIndex={0}
                              onClick={() => setCarouselStudioSlideIdx(idx)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setCarouselStudioSlideIdx(idx);
                                }
                              }}
                              className="cursor-pointer rounded-xl border p-3 outline-none transition-[box-shadow,border-color]"
                              style={{
                                borderColor: isStudioSlide ? "var(--accent)" : "var(--border-default)",
                                background: "var(--bg-secondary)",
                                boxShadow: isStudioSlide ? "0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent)" : undefined,
                              }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
                                  {appLanguage === "Swedish" ? "Slide" : "Slide"} {idx + 1}
                                </p>
                                {isStudioSlide ? (
                                  <span className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ background: "var(--accent)" }}>
                                    {appLanguage === "Swedish" ? "Aktiv" : "Active"}
                                  </span>
                                ) : null}
                              </div>
                              <input
                                value={slide.headline}
                                onChange={(e) =>
                                  updateCarouselSlide(activeCarouselDraft.id, slide.id, {
                                    headline: e.target.value,
                                    headlineHtml: textToHtml(e.target.value),
                                  })
                                }
                                onClick={(e) => e.stopPropagation()}
                                placeholder={appLanguage === "Swedish" ? "Rubrik" : "Headline"}
                                className="mt-2 w-full rounded-lg border px-2.5 py-1.5 text-xs"
                                style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                              />
                              <textarea
                                value={slide.body}
                                onChange={(e) =>
                                  updateCarouselSlide(activeCarouselDraft.id, slide.id, {
                                    body: e.target.value,
                                    bodyHtml: textToHtml(e.target.value),
                                  })
                                }
                                onClick={(e) => e.stopPropagation()}
                                placeholder={appLanguage === "Swedish" ? "Brodtext" : "Body"}
                                rows={3}
                                className="mt-2 w-full resize-y rounded-lg border px-2.5 py-1.5 text-xs leading-relaxed"
                                style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                              />
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                <label className="text-[10px] font-medium text-[var(--text-tertiary)]">
                                  {appLanguage === "Swedish" ? "Rubrik storlek" : "Headline size"}
                                  <input
                                    type="number"
                                    min={24}
                                    max={140}
                                    value={slide.headlineSize ?? 72}
                                    onChange={(e) =>
                                      updateCarouselSlide(activeCarouselDraft.id, slide.id, {
                                        headlineSize: Math.max(24, Math.min(140, Number(e.target.value) || 72)),
                                      })
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    className="mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
                                    style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                                  />
                                </label>
                                <label className="text-[10px] font-medium text-[var(--text-tertiary)]">
                                  {appLanguage === "Swedish" ? "Brod storlek" : "Body size"}
                                  <input
                                    type="number"
                                    min={18}
                                    max={96}
                                    value={slide.bodySize ?? 38}
                                    onChange={(e) =>
                                      updateCarouselSlide(activeCarouselDraft.id, slide.id, {
                                        bodySize: Math.max(18, Math.min(96, Number(e.target.value) || 38)),
                                      })
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    className="mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
                                    style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                                  />
                                </label>
                              </div>
                              <button
                                type="button"
                                className="mt-2 w-full rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors hover:opacity-90"
                                style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  document.execCommand("styleWithCSS", false, "true");
                                  document.execCommand("hiliteColor", false, "#f6d74f");
                                }}
                              >
                                {appLanguage === "Swedish" ? "Markera vald text" : "Highlight selected text"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </aside>

                <section className="flex min-w-0 flex-col gap-5">
                  {activeCarouselDraft ? (
                    <>
                      <div
                        className="rounded-2xl border p-4 shadow-[var(--shadow-sm)] sm:p-5"
                        style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)" }}
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                          <input
                            value={activeCarouselDraft.name}
                            onChange={(e) => updateCarouselDraftName(activeCarouselDraft.id, e.target.value)}
                            className="min-w-0 flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium"
                            style={{ borderColor: "var(--border-default)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
                            placeholder={appLanguage === "Swedish" ? "Karusellnamn" : "Carousel name"}
                          />
                          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                            <button
                              type="button"
                              onClick={() => applyReferencePreset(activeCarouselDraft.id)}
                              className="rounded-xl border px-4 py-2 text-xs font-semibold transition-colors hover:bg-[var(--bg-hover)]"
                              style={{ borderColor: "var(--border-default)", background: "var(--bg-secondary)", color: "var(--text-secondary)" }}
                            >
                              {appLanguage === "Swedish" ? "Matcha referens" : "Match reference"}
                            </button>
                            <button
                              type="button"
                              onClick={() => addCarouselSlide(activeCarouselDraft.id)}
                              className="rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                              style={{ background: "var(--accent-gradient)" }}
                            >
                              {appLanguage === "Swedish" ? "Lagg till slide" : "Add slide"}
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 pt-1 [scrollbar-width:thin]">
                          {activeCarouselDraft.slides.map((s, idx) => {
                            const on = idx === carouselStudioSlideIdx;
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => setCarouselStudioSlideIdx(idx)}
                                className="flex h-10 min-w-[2.75rem] shrink-0 items-center justify-center rounded-lg border text-xs font-semibold transition-all"
                                style={{
                                  borderColor: on ? "var(--accent)" : "var(--border-default)",
                                  background: on ? "color-mix(in srgb, var(--accent) 18%, transparent)" : "var(--bg-secondary)",
                                  color: on ? "var(--text-primary)" : "var(--text-secondary)",
                                  boxShadow: on ? "0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent)" : undefined,
                                }}
                              >
                                {idx + 1}
                              </button>
                            );
                          })}
                        </div>

                        {(() => {
                          const idx = carouselStudioSlideIdx;
                          const slide = activeCarouselDraft.slides[idx];
                          if (!slide) return null;
                          const isFirstSlide = idx === 0;
                          const selectedLayout =
                            carouselLayouts.find((layout) => layout.id === slide.layoutId) ?? carouselLayouts[0] ?? getDefaultCarouselLayouts()[0];
                          const tone = slide.tone ?? "soft";
                          const textAlign = slide.textAlign ?? "left";
                          const alignClass = textAlign === "center" ? "text-center" : "text-left";
                          const toneBackground =
                            tone === "dark" ? "var(--bg-primary)" : tone === "accent" ? "#fff6d8" : "#ffffff";
                          const headlineSize = slide.headlineSize ?? (isFirstSlide ? 72 : 42);
                          const bodySize = slide.bodySize ?? (isFirstSlide ? 38 : 30);
                          return (
                            <div className="mt-5" key={slide.id}>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                                  {appLanguage === "Swedish" ? "Slide" : "Slide"} {idx + 1}
                                  {isFirstSlide ? (
                                    <span className="ml-2 font-normal normal-case text-[var(--text-tertiary)]">
                                      · {appLanguage === "Swedish" ? "Cover" : "Cover"}
                                    </span>
                                  ) : null}
                                </p>
                                <p className="text-[11px] text-[var(--text-tertiary)]">
                                  {appLanguage === "Swedish"
                                    ? "Klicka i canvas for att redigera text direkt."
                                    : "Click the canvas to edit text in place."}
                                </p>
                              </div>
                              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                                <label className="block text-[10px] font-medium text-[var(--text-tertiary)] lg:col-span-1">
                                  {appLanguage === "Swedish" ? "Layout" : "Layout"}
                                  <select
                                    value={slide.layoutId}
                                    onChange={(e) => updateCarouselSlide(activeCarouselDraft.id, slide.id, { layoutId: e.target.value })}
                                    className="mt-1 w-full rounded-xl border px-3 py-2 text-xs"
                                    style={{ borderColor: "var(--border-default)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
                                  >
                                    {carouselLayouts.map((layout) => (
                                      <option key={layout.id} value={layout.id}>
                                        {layout.name}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block text-[10px] font-medium text-[var(--text-tertiary)]">
                                  {appLanguage === "Swedish" ? "Justering" : "Alignment"}
                                  <select
                                    value={textAlign}
                                    onChange={(e) =>
                                      updateCarouselSlide(activeCarouselDraft.id, slide.id, {
                                        textAlign: e.target.value as "left" | "center",
                                      })
                                    }
                                    className="mt-1 w-full rounded-xl border px-3 py-2 text-xs"
                                    style={{ borderColor: "var(--border-default)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
                                  >
                                    <option value="left">{appLanguage === "Swedish" ? "Vanster" : "Left"}</option>
                                    <option value="center">{appLanguage === "Swedish" ? "Centrerat" : "Center"}</option>
                                  </select>
                                </label>
                                <label className="block text-[10px] font-medium text-[var(--text-tertiary)]">
                                  {appLanguage === "Swedish" ? "Ton" : "Tone"}
                                  <select
                                    value={tone}
                                    onChange={(e) =>
                                      updateCarouselSlide(activeCarouselDraft.id, slide.id, {
                                        tone: e.target.value as "soft" | "dark" | "accent",
                                      })
                                    }
                                    className="mt-1 w-full rounded-xl border px-3 py-2 text-xs"
                                    style={{ borderColor: "var(--border-default)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
                                  >
                                    <option value="soft">{appLanguage === "Swedish" ? "Mjuk" : "Soft"}</option>
                                    <option value="accent">{appLanguage === "Swedish" ? "Accent" : "Accent"}</option>
                                    <option value="dark">{appLanguage === "Swedish" ? "Mork" : "Dark"}</option>
                                  </select>
                                </label>
                              </div>

                              <div
                                className="mt-5 rounded-2xl border p-4 sm:p-6"
                                style={{
                                  borderColor: "var(--border-subtle)",
                                  background: "linear-gradient(180deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%)",
                                }}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                                    {appLanguage === "Swedish" ? "Forhandsvisning" : "Preview"} · 1080 × 1440
                                  </span>
                                </div>
                                <div className="mt-4 flex justify-center">
                                  <div
                                    className="aspect-[3/4] w-full max-w-[min(100%,360px)] overflow-hidden rounded-2xl border shadow-[0_20px_50px_-20px_rgba(0,0,0,0.35)] ring-1 ring-black/5"
                                    style={{ borderColor: "var(--border-default)", background: toneBackground }}
                                  >
                                    {isFirstSlide ? (
                                      <div className="relative h-full w-full">
                                        <div
                                          className="absolute flex items-end"
                                          style={{
                                            left: REFERENCE_CAROUSEL.leftInset,
                                            width: REFERENCE_CAROUSEL.headlineWidth,
                                            bottom: REFERENCE_CAROUSEL.topAnchor,
                                          }}
                                        >
                                          <p
                                            className="font-caveat cursor-text leading-[0.9] text-[#111111]"
                                            contentEditable
                                            suppressContentEditableWarning
                                            dangerouslySetInnerHTML={{ __html: slide.headlineHtml || textToHtml(slide.headline || "Headline preview") }}
                                            style={{
                                              fontSize: `${headlineSize}px`,
                                              transform: `rotate(${REFERENCE_CAROUSEL.headlineRotationDeg}deg)`,
                                              transformOrigin: "left bottom",
                                              maxWidth: "100%",
                                            }}
                                            onBlur={(e) =>
                                              updateCarouselSlide(activeCarouselDraft.id, slide.id, {
                                                headline: e.currentTarget.innerText.trim(),
                                                headlineHtml: e.currentTarget.innerHTML,
                                              })
                                            }
                                          />
                                        </div>
                                        <div
                                          className="absolute h-[6px] rounded-full bg-black/85"
                                          style={{
                                            left: REFERENCE_CAROUSEL.leftInset,
                                            width: REFERENCE_CAROUSEL.underlineWidth,
                                            top: REFERENCE_CAROUSEL.underlineTop,
                                            transform: "rotate(-6deg)",
                                            transformOrigin: "left center",
                                          }}
                                        />
                                        <div
                                          className="absolute"
                                          style={{
                                            left: REFERENCE_CAROUSEL.leftInset,
                                            width: REFERENCE_CAROUSEL.bodyWidth,
                                            top: REFERENCE_CAROUSEL.bottomTop,
                                          }}
                                        >
                                          <p
                                            className="font-nourd cursor-text font-semibold leading-[1.12] text-[#222222]"
                                            contentEditable
                                            suppressContentEditableWarning
                                            dangerouslySetInnerHTML={{ __html: slide.bodyHtml || textToHtml(slide.body || "Body preview") }}
                                            style={{ fontSize: `${bodySize}px`, maxWidth: "100%" }}
                                            onBlur={(e) =>
                                              updateCarouselSlide(activeCarouselDraft.id, slide.id, {
                                                body: e.currentTarget.innerText.trim(),
                                                bodyHtml: e.currentTarget.innerHTML,
                                              })
                                            }
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <div className={`relative h-full w-full ${selectedLayout.cardClass} ${alignClass}`}>
                                        <p
                                          className={`${selectedLayout.titleClass} cursor-text`}
                                          contentEditable
                                          suppressContentEditableWarning
                                          dangerouslySetInnerHTML={{ __html: slide.headlineHtml || textToHtml(slide.headline || "Headline preview") }}
                                          style={{
                                            position: "absolute",
                                            left: `${selectedLayout.headlineX ?? 10}%`,
                                            top: `${selectedLayout.headlineY ?? 14}%`,
                                            width: `${selectedLayout.headlineWidth ?? 80}%`,
                                            fontSize: `${selectedLayout.headlineFontSize ?? headlineSize}px`,
                                          }}
                                          onBlur={(e) =>
                                            updateCarouselSlide(activeCarouselDraft.id, slide.id, {
                                              headline: e.currentTarget.innerText.trim(),
                                              headlineHtml: e.currentTarget.innerHTML,
                                            })
                                          }
                                        />
                                        <p
                                          className={`${selectedLayout.bodyClass} cursor-text`}
                                          contentEditable
                                          suppressContentEditableWarning
                                          dangerouslySetInnerHTML={{ __html: slide.bodyHtml || textToHtml(slide.body || "Body preview") }}
                                          style={{
                                            position: "absolute",
                                            left: `${selectedLayout.bodyX ?? 10}%`,
                                            top: `${selectedLayout.bodyY ?? 60}%`,
                                            width: `${selectedLayout.bodyWidth ?? 80}%`,
                                            fontSize: `${selectedLayout.bodyFontSize ?? bodySize}px`,
                                          }}
                                          onBlur={(e) =>
                                            updateCarouselSlide(activeCarouselDraft.id, slide.id, {
                                              body: e.currentTarget.innerText.trim(),
                                              bodyHtml: e.currentTarget.innerHTML,
                                            })
                                          }
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div
                        className="rounded-2xl border p-4 shadow-[var(--shadow-sm)] sm:p-5"
                        style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)" }}
                      >
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                              {appLanguage === "Swedish" ? "Layoutsmallar" : "Layout templates"}
                            </h3>
                            <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-[var(--text-tertiary)]">
                              {appLanguage === "Swedish"
                                ? "Dra rubrik- och brodtextblock i miniatyrerna. Andringar galler alla slides som anvander samma layout."
                                : "Drag headline and body blocks in the thumbnails. Changes apply to every slide that uses that layout."}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          {carouselLayouts.map((layout) => (
                            <div
                              key={layout.id}
                              className="flex flex-col rounded-xl border p-3 transition-shadow hover:shadow-md"
                              style={{ borderColor: "var(--border-default)", background: "var(--bg-secondary)" }}
                            >
                              <input
                                value={layout.name}
                                onChange={(e) => updateCarouselLayout(layout.id, { name: e.target.value })}
                                className="w-full rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
                                style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                              />
                              <div
                                className="relative mx-auto mt-3 aspect-[3/4] w-full max-w-[200px] overflow-hidden rounded-xl border bg-white shadow-inner"
                                style={{ borderColor: "var(--border-default)", userSelect: "none" }}
                                onMouseMove={(e) => {
                                  if (!layoutDrag || layoutDrag.layoutId !== layout.id) return;
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const x = clampPercent(((e.clientX - rect.left) / rect.width) * 100, 0, 90);
                                  const y = clampPercent(((e.clientY - rect.top) / rect.height) * 100, 0, 95);
                                  if (layoutDrag.target === "headline") {
                                    updateCarouselLayout(layout.id, { headlineX: x, headlineY: y });
                                  } else {
                                    updateCarouselLayout(layout.id, { bodyX: x, bodyY: y });
                                  }
                                }}
                                onMouseUp={() => setLayoutDrag(null)}
                                onMouseLeave={() => setLayoutDrag(null)}
                              >
                                <div
                                  className={`${layout.titleClass} absolute cursor-grab active:cursor-grabbing border border-dashed border-black/25 bg-white/90 p-1 shadow-sm`}
                                  style={{
                                    left: `${layout.headlineX ?? 10}%`,
                                    top: `${layout.headlineY ?? 14}%`,
                                    width: `${layout.headlineWidth ?? 80}%`,
                                    fontSize: `${layout.headlineFontSize ?? 40}px`,
                                  }}
                                  onMouseDown={() => setLayoutDrag({ layoutId: layout.id, target: "headline" })}
                                >
                                  Headline
                                </div>
                                <div
                                  className={`${layout.bodyClass} absolute cursor-grab active:cursor-grabbing border border-dashed border-black/25 bg-white/90 p-1 shadow-sm`}
                                  style={{
                                    left: `${layout.bodyX ?? 10}%`,
                                    top: `${layout.bodyY ?? 60}%`,
                                    width: `${layout.bodyWidth ?? 80}%`,
                                    fontSize: `${layout.bodyFontSize ?? 24}px`,
                                  }}
                                  onMouseDown={() => setLayoutDrag({ layoutId: layout.id, target: "body" })}
                                >
                                  Body
                                </div>
                              </div>
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <label className="text-[10px] font-medium text-[var(--text-tertiary)]">
                                  {appLanguage === "Swedish" ? "Rubrik px" : "Headline px"}
                                  <input
                                    type="number"
                                    value={layout.headlineFontSize ?? 40}
                                    min={18}
                                    max={120}
                                    onChange={(e) => updateCarouselLayout(layout.id, { headlineFontSize: Number(e.target.value) || 40 })}
                                    className="mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
                                    style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                                  />
                                </label>
                                <label className="text-[10px] font-medium text-[var(--text-tertiary)]">
                                  {appLanguage === "Swedish" ? "Brod px" : "Body px"}
                                  <input
                                    type="number"
                                    value={layout.bodyFontSize ?? 24}
                                    min={14}
                                    max={80}
                                    onChange={(e) => updateCarouselLayout(layout.id, { bodyFontSize: Number(e.target.value) || 24 })}
                                    className="mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
                                    style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                                  />
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div
                      className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center"
                      style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)" }}
                    >
                      <p className="text-sm font-medium text-[var(--text-secondary)]">
                        {appLanguage === "Swedish" ? "Ingen karusell vald" : "No carousel selected"}
                      </p>
                      <p className="mt-2 max-w-sm text-xs leading-relaxed text-[var(--text-tertiary)]">
                        {appLanguage === "Swedish"
                          ? "Skapa ett nytt projekt i sidopanelen eller valj en befintlig karusell."
                          : "Create a new project in the sidebar or pick an existing carousel."}
                      </p>
                      <button
                        type="button"
                        className="mt-5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
                        style={{ background: "var(--accent-gradient)" }}
                        onClick={createCarouselDraft}
                      >
                        {appLanguage === "Swedish" ? "Skapa karusell" : "Create carousel"}
                      </button>
                    </div>
                  )}
                </section>
              </div>
            </>
          ) : null}

          {activeView === "calendar" ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                  {appLanguage === "Swedish" ? "Innehallskalender" : "Content calendar"}
                </h2>
                <button
                  type="button"
                  onClick={onClearUnlockedCalendarHooks}
                  className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    borderColor: "var(--border-default)",
                    background: "var(--bg-elevated)",
                    color: "var(--text-secondary)",
                  }}
                  title={
                    appLanguage === "Swedish"
                      ? "Tom hook-falt pa alla olasta dagar"
                      : "Clear hook text on all days that are not locked"
                  }
                >
                  {appLanguage === "Swedish" ? "Rensa kalender" : "Clear calendar"}
                </button>
              </div>
              <div className="mt-3 space-y-3">
                {Array.from({ length: 4 }).map((_, weekIdx) => {
                  const week = weekIdx + 1;
                  const weekEntries = calendarEntries
                    .filter((entry) => entry.week === week)
                    .sort(
                      (a, b) =>
                        CALENDAR_DAYS.indexOf(a.day as (typeof CALENDAR_DAYS)[number]) -
                        CALENDAR_DAYS.indexOf(b.day as (typeof CALENDAR_DAYS)[number]),
                    );
                  return (
                    <section key={`week-${week}`} className="rounded-xl border p-3" style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)" }}>
                      <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">{`Week ${week}`}</h3>
                      <div className="grid gap-2 xl:grid-cols-4 2xl:grid-cols-7">
                        {weekEntries.map((entry) => {
                          const entryTopicBg =
                            entry.topicSlot === "topic1"
                              ? "color-mix(in srgb, var(--bg-elevated) 93%, var(--accent) 7%)"
                              : "color-mix(in srgb, var(--bg-elevated) 84%, var(--bg-tertiary) 16%)";
                          const completedGreen = "rgba(34, 197, 94, 0.26)";
                          let cardBackground = "var(--bg-elevated)";
                          let headerBackground = entryTopicBg;
                          let cardBorder: string = "var(--border-default)";
                          let cardBoxShadow: string | undefined;

                          if (entry.completed) {
                            cardBackground = completedGreen;
                            headerBackground = completedGreen;
                            cardBorder = "rgba(21, 128, 61, 0.5)";
                          } else if (entry.locked) {
                            cardBackground = "var(--bg-elevated)";
                            headerBackground = entryTopicBg;
                            cardBorder = "rgba(217, 119, 6, 0.75)";
                            cardBoxShadow = "inset 3px 0 0 0 rgba(245, 158, 11, 0.95)";
                          }

                          return (
                          <div
                            key={entry.id}
                            className="overflow-hidden rounded-lg border"
                            style={{
                              borderColor: cardBorder,
                              background: cardBackground,
                              boxShadow: cardBoxShadow,
                            }}
                          >
                            <div
                              className="flex items-center justify-between gap-1 px-2 py-1.5"
                              style={{ background: headerBackground }}
                            >
                              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{entry.day}</p>
                              <div className="flex items-center gap-1.5">
                                <label className="flex cursor-pointer select-none items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
                                  <input
                                    type="checkbox"
                                    checked={entry.completed}
                                    onChange={(e) => updateCalendarEntry(entry.id, { completed: e.target.checked })}
                                    className="h-3.5 w-3.5 shrink-0 rounded border"
                                    style={{ borderColor: "var(--border-default)", accentColor: "rgb(22, 163, 74)" }}
                                  />
                                  <span>{appLanguage === "Swedish" ? "Klar" : "Done"}</span>
                                </label>
                                <button
                                  type="button"
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-[background-color,border-color,color]"
                                  style={{
                                    borderColor: entry.locked ? "rgb(180, 83, 9)" : "var(--border-default)",
                                    background: entry.locked ? "rgba(254, 243, 199, 0.45)" : "var(--bg-elevated)",
                                    color: entry.locked ? "rgb(146, 64, 14)" : "var(--text-tertiary)",
                                  }}
                                  aria-label={
                                    entry.locked
                                      ? appLanguage === "Swedish"
                                        ? "Las upp dag"
                                        : "Unlock day"
                                      : appLanguage === "Swedish"
                                        ? "Las dag"
                                        : "Lock day"
                                  }
                                  aria-pressed={entry.locked}
                                  onClick={() => updateCalendarEntry(entry.id, { locked: !entry.locked })}
                                >
                                  <CalendarLockGlyph locked={entry.locked} />
                                </button>
                              </div>
                            </div>
                            <div className="px-2 pb-2 pt-1.5">
                            <select
                              value={entry.topicSlot}
                              onChange={(e) => updateCalendarEntry(entry.id, { topicSlot: e.target.value as "topic1" | "topic2" })}
                              aria-label={appLanguage === "Swedish" ? "Amne" : "Topic"}
                              className="mt-1 w-full cursor-pointer border-0 bg-transparent py-1 text-xs outline-none focus:ring-0"
                              style={{ color: "var(--text-primary)" }}
                            >
                              <option value="topic1">{topicOne || "Topic 1"}</option>
                              <option value="topic2">{topicTwo || "Topic 2"}</option>
                            </select>
                            <select
                              value={CALENDAR_HOOK_TYPES.includes(entry.hookType as (typeof CALENDAR_HOOK_TYPES)[number]) ? entry.hookType : CALENDAR_HOOK_TYPES[0]}
                              onChange={(e) => updateCalendarEntry(entry.id, { hookType: e.target.value })}
                              aria-label={appLanguage === "Swedish" ? "Hook-typ" : "Hook type"}
                              className="mt-1 w-full cursor-pointer border-0 bg-transparent py-1 text-xs outline-none focus:ring-0"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {CALENDAR_HOOK_TYPES.map((ht) => (
                                <option key={ht} value={ht}>
                                  {ht}
                                </option>
                              ))}
                            </select>
                            <select
                              value={
                                CALENDAR_FORMAT_OPTIONS.includes(entry.format as (typeof CALENDAR_FORMAT_OPTIONS)[number])
                                  ? entry.format
                                  : CALENDAR_FORMAT_OPTIONS[0]
                              }
                              onChange={(e) => updateCalendarEntry(entry.id, { format: e.target.value })}
                              aria-label={appLanguage === "Swedish" ? "Format" : "Format"}
                              className="mt-1 w-full cursor-pointer border-0 bg-transparent py-1 text-xs outline-none focus:ring-0"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {CALENDAR_FORMAT_OPTIONS.map((fmt) => (
                                <option key={fmt} value={fmt}>
                                  {fmt}
                                </option>
                              ))}
                            </select>
                            <label className="mt-1 block text-[10px] text-[var(--text-tertiary)]">
                              Hook
                              <CalendarHookAutosizeTextarea
                                value={entry.hookText}
                                onChange={(next) => updateCalendarEntry(entry.id, { hookText: next })}
                                className="mt-0.5 w-full rounded-md border px-3 py-2 text-base leading-relaxed"
                                style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                              />
                            </label>
                            <div className="mt-2 flex flex-wrap gap-1">
                              <button
                                type="button"
                                disabled={
                                  !entry.hookText.trim() || ideasLoadingId === calendarAhaLoadingKey(entry.id)
                                }
                                onClick={() => void onGenerateAhaFromCalendarDay(entry)}
                                className="rounded-md border px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-60"
                                style={{
                                  borderColor: "var(--border-default)",
                                  background: "var(--bg-tertiary)",
                                  color: "var(--text-secondary)",
                                }}
                                title={
                                  appLanguage === "Swedish"
                                    ? "Generera Aha och slutsatser från dagens hook"
                                    : "Generate Aha + conclusions from this day’s hook"
                                }
                                aria-label={
                                  appLanguage === "Swedish"
                                    ? "Generera Aha från dagens hook"
                                    : "Generate Aha from this day’s hook"
                                }
                              >
                                {ideasLoadingId === calendarAhaLoadingKey(entry.id) ? "⏳" : "💡"}
                              </button>
                              <button
                                type="button"
                                disabled={
                                  !entry.hookText.trim() || scriptLoadingId === calendarScriptLoadingKey(entry.id)
                                }
                                onClick={() => void onGenerateScriptFromCalendarDay(entry)}
                                className="rounded-md border px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-60"
                                style={{
                                  borderColor: "var(--border-default)",
                                  background: "var(--bg-tertiary)",
                                  color: "var(--text-secondary)",
                                }}
                                title={
                                  appLanguage === "Swedish"
                                    ? "Generera manus och storyboard från dagens hook"
                                    : "Generate script and storyboard from this day’s hook"
                                }
                                aria-label={
                                  appLanguage === "Swedish"
                                    ? "Generera manus från dagens hook"
                                    : "Generate script from this day’s hook"
                                }
                              >
                                {scriptLoadingId === calendarScriptLoadingKey(entry.id) ? "⏳" : "🎬"}
                              </button>
                            </div>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            </>
          ) : null}

          {activeView === "reddit" ? (
            <>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                {appLanguage === "Swedish" ? "Reddit-ämnen" : "Reddit topics"}
              </h2>
              <p className="mt-2 text-sm text-[var(--text-tertiary)]">
                {appLanguage === "Swedish"
                  ? "OpenAI skapar 10 amnesrader i stil med r/Showerthoughts och r/Damnthatsinteresting utifrån dina hook-rader (inte riktiga inlagg fran Reddit). Klicka pa 'Hitta Reddit-amnen' i vansterpanelen."
                  : "OpenAI generates 10 topic lines in the spirit of r/Showerthoughts and r/Damnthatsinteresting from your Topic 1 and Topic 2 hooks (not real Reddit posts). Click 'Find Reddit Topics' in the left panel."}
              </p>
              <div className="mt-4 space-y-2">
                {redditTopicPosts.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-4 text-sm text-[var(--text-tertiary)]" style={{ borderColor: "var(--border-default)" }}>
                    {redditTopicsLoading
                      ? appLanguage === "Swedish"
                        ? "Skapar forslag med OpenAI..."
                        : "Generating ideas with OpenAI..."
                      : appLanguage === "Swedish"
                        ? "Inga forslag annu. Klicka pa 'Hitta Reddit-amnen' for att skapa 10 rader."
                        : "No ideas yet. Click 'Find Reddit Topics' to generate 10 lines."}
                  </div>
                ) : (
                  redditTopicPosts.map((post, idx) => (
                    <article
                      key={post.id}
                      className="rounded-xl border p-3 text-sm"
                      style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)" }}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                          #{idx + 1} · r/{post.subreddit} ·{" "}
                          {appLanguage === "Swedish" ? "AI-forslag" : "AI suggestion"}
                        </span>
                        <span className="text-xs text-[var(--text-tertiary)]">
                          {appLanguage === "Swedish" ? "intresse" : "interest"} · {post.score}
                        </span>
                      </div>
                      <h3 className="mt-1.5 font-medium leading-snug text-[var(--text-primary)]">{post.title}</h3>
                      {post.url ? (
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block text-xs font-medium underline decoration-[var(--border-default)] underline-offset-2"
                          style={{ color: "var(--accent)" }}
                        >
                          {appLanguage === "Swedish" ? "Oppna pa Reddit" : "Open on Reddit"}
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="mt-2 text-left text-xs font-medium underline decoration-[var(--border-default)] underline-offset-2"
                          style={{ color: "var(--accent)" }}
                          onClick={() => void navigator.clipboard.writeText(post.title)}
                        >
                          {appLanguage === "Swedish" ? "Kopiera titel" : "Copy title"}
                        </button>
                      )}
                    </article>
                  ))
                )}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}

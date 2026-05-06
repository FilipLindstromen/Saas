"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import hookTransformInstructions from "@/data/hook-transform-instructions.json";
import {
  type ExpansionPack,
  type ScriptStoryboard,
  generateContentIdeas,
  generateHookVariations,
  generateNetflixifyScripts,
  recalculateHookScores,
  generateScriptStoryboard,
  generateTrendingHooks,
  generateWinningHookExpansion,
  rewriteWinningHook,
  type HookVariation,
} from "@/lib/generate-hooks";
import { loadSharedOpenAiKey } from "@/lib/saas-api-keys";
import { ThemeToggle } from "@/components/theme-toggle";

const DEFAULT_AUDIENCE = "High-performing professionals";
const DEFAULT_LIGHTHOUSE = "Your problems aren't in your head, they are in your body.";
const STORAGE_KEY = "hook-transformer-state-v2";
const PLATFORMS = ["Instagram Reel", "Instagram Carousel", "Instagram AD (lead magnet / low ticket)", "TikTok", "YouTube Shorts"] as const;
const STYLE_PRESETS = ["Casual", "Direct", "Curious", "Bold", "Empathetic"] as const;

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

type Collection = {
  id: string;
  name: string;
  items: SavedItem[];
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
};

type CarouselSlide = {
  id: string;
  headline: string;
  body: string;
  layoutId: string;
  textAlign?: "left" | "center";
  tone?: "soft" | "dark" | "accent";
};

type CarouselDraft = {
  id: string;
  name: string;
  createdAt: string;
  slides: CarouselSlide[];
};

function getDefaultCarouselLayouts(): CarouselLayout[] {
  return [
    {
      id: "layout-minimal",
      name: "Hook poster",
      titleClass: "font-caveat text-5xl leading-[0.95] text-[#111111] sm:text-6xl",
      bodyClass: "font-nourd mt-14 text-2xl font-semibold leading-tight text-[#222222] sm:text-3xl",
      cardClass: "rounded-none border-0 px-8 py-16 sm:px-12",
    },
    {
      id: "layout-bold",
      name: "Bold contrast",
      titleClass: "text-2xl font-extrabold uppercase tracking-wide text-[var(--text-primary)]",
      bodyClass: "mt-3 text-sm leading-relaxed text-[var(--text-secondary)]",
      cardClass: "rounded-2xl border-2 p-5",
    },
    {
      id: "layout-story",
      name: "Story card",
      titleClass: "text-lg font-semibold italic text-[var(--text-primary)]",
      bodyClass: "mt-2 text-sm leading-relaxed text-[var(--text-secondary)]",
      cardClass: "rounded-3xl border p-6",
    },
  ];
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
  }));
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toResultItems(hooks: HookVariation[]): ResultItem[] {
  return hooks
    .slice()
    .sort((a, b) => b.score - a.score)
    .map((item) => ({
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

export default function HomePage() {
  const VIEWS = ["variants", "aha", "script", "carousel"] as const;
  type View = (typeof VIEWS)[number];

  const [targetAudience, setTargetAudience] = useState(DEFAULT_AUDIENCE);
  const [lighthouseHeadline, setLighthouseHeadline] = useState(DEFAULT_LIGHTHOUSE);
  const [hook, setHook] = useState("");
  const [uniquePerspective, setUniquePerspective] = useState("");
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
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string>("");
  const [collectionNameInput, setCollectionNameInput] = useState("");
  const [ideaBatches, setIdeaBatches] = useState<IdeaBatch[]>([]);
  const [favoriteIdeas, setFavoriteIdeas] = useState<FavoriteIdea[]>([]);
  const [expansionBatches, setExpansionBatches] = useState<ExpansionBatch[]>([]);
  const [scriptBoards, setScriptBoards] = useState<ScriptBoardEntry[]>([]);
  const [netflixifyBatches, setNetflixifyBatches] = useState<NetflixifyBatch[]>([]);
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        targetAudience: string;
        lighthouseHeadline: string;
        hook: string;
        uniquePerspective: string;
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
        collections: Collection[];
        activeCollectionId: string;
        ideaBatches: IdeaBatch[];
        favoriteIdeas: FavoriteIdea[];
        expansionBatches: ExpansionBatch[];
        scriptBoards: ScriptBoardEntry[];
        netflixifyBatches: NetflixifyBatch[];
        carouselLayouts: CarouselLayout[];
        carouselDrafts: CarouselDraft[];
        activeCarouselId: string;
      }>;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (typeof parsed.targetAudience === "string") setTargetAudience(parsed.targetAudience);
      if (typeof parsed.lighthouseHeadline === "string") setLighthouseHeadline(parsed.lighthouseHeadline);
      if (typeof parsed.hook === "string") setHook(parsed.hook);
      if (typeof parsed.uniquePerspective === "string") setUniquePerspective(parsed.uniquePerspective);
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
        setResults(normalized.slice().sort((a, b) => b.score - a.score));
      }
      if (Array.isArray(parsed.favorites)) setFavorites(parsed.favorites);
      if (Array.isArray(parsed.collections)) setCollections(parsed.collections);
      if (typeof parsed.activeCollectionId === "string") setActiveCollectionId(parsed.activeCollectionId);
      if (Array.isArray(parsed.ideaBatches)) setIdeaBatches(parsed.ideaBatches);
      if (Array.isArray(parsed.favoriteIdeas)) setFavoriteIdeas(parsed.favoriteIdeas);
      if (Array.isArray(parsed.expansionBatches)) setExpansionBatches(parsed.expansionBatches);
      if (Array.isArray(parsed.scriptBoards)) setScriptBoards(parsed.scriptBoards);
      if (Array.isArray(parsed.netflixifyBatches)) setNetflixifyBatches(parsed.netflixifyBatches);
      if (Array.isArray(parsed.carouselLayouts) && parsed.carouselLayouts.length > 0) setCarouselLayouts(parsed.carouselLayouts);
      if (Array.isArray(parsed.carouselDrafts)) setCarouselDrafts(parsed.carouselDrafts);
      if (typeof parsed.activeCarouselId === "string") setActiveCarouselId(parsed.activeCarouselId);
    } catch {
      // ignore invalid local storage payload
    }
  }, []);

  useEffect(() => {
    const payload = {
      targetAudience,
      lighthouseHeadline,
      hook,
      uniquePerspective,
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
      collections,
      activeCollectionId,
      ideaBatches,
      favoriteIdeas,
      expansionBatches,
      scriptBoards,
      netflixifyBatches,
      carouselLayouts,
      carouselDrafts,
      activeCarouselId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [
    targetAudience,
    lighthouseHeadline,
    hook,
    uniquePerspective,
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
    collections,
    activeCollectionId,
    ideaBatches,
    favoriteIdeas,
    expansionBatches,
    scriptBoards,
    netflixifyBatches,
    carouselLayouts,
    carouselDrafts,
    activeCarouselId,
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
    if (!hook.trim()) {
      setError("Enter a hook to transform.");
      return;
    }
    setLoading(true);
    setLoadingLabel("Generating...");
    try {
      const hooks = await generateHookVariations({
        apiKey,
        targetAudience,
        hook,
        platform,
        stylePreset,
        curiosityLevel,
        useContrarianHook,
        useBrandVoiceLock,
        brandVoiceSample,
        uniquePerspective,
        instructions: hookTransformInstructions,
      });
      setResults(toResultItems(hooks));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [brandVoiceSample, curiosityLevel, hook, platform, stylePreset, targetAudience, uniquePerspective, useBrandVoiceLock, useContrarianHook]);

  const onRecalculateScores = useCallback(async () => {
    setError(null);
    if (results.length === 0) {
      setError("Generate hooks first, then recalculate scores.");
      return;
    }
    const apiKey = loadSharedOpenAiKey();
    setLoading(true);
    setLoadingLabel("Recalculating scores...");
    try {
      const rescored = await recalculateHookScores({
        apiKey,
        targetAudience,
        platform,
        useBrandVoiceLock,
        brandVoiceSample,
        hooks: results.map((item) => item.text),
      });
      const byText = new Map(rescored.map((item) => [item.text, item]));
      const next = results
        .map((item) => {
          const scoreData = byText.get(item.text);
          return scoreData
            ? {
                ...item,
                score: scoreData.score,
                reasons: scoreData.reasons,
                improveTip: scoreData.improveTip,
              }
            : item;
        })
        .slice()
        .sort((a, b) => b.score - a.score);
      setResults(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to recalculate scores.");
    } finally {
      setLoading(false);
      setLoadingLabel("Generating...");
    }
  }, [brandVoiceSample, platform, results, targetAudience, useBrandVoiceLock]);

  const onFindTrendingHooks = useCallback(async () => {
    setError(null);
    const apiKey = loadSharedOpenAiKey();
    if (!hook.trim()) {
      setError("Enter a hook first so I can find matching trend hooks.");
      return;
    }
    setLoading(true);
    setLoadingLabel("Finding trends...");
    try {
      const hooks = await generateTrendingHooks({
        apiKey,
        targetAudience,
        hook,
        stylePreset,
        curiosityLevel,
        useContrarianHook,
        useBrandVoiceLock,
        brandVoiceSample,
        uniquePerspective,
      });
      setResults(toResultItems(hooks));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to find trending hooks.");
    } finally {
      setLoading(false);
      setLoadingLabel("Generating...");
    }
  }, [brandVoiceSample, curiosityLevel, hook, stylePreset, targetAudience, uniquePerspective, useBrandVoiceLock, useContrarianHook]);

  const addToFavorites = useCallback(
    (item: ResultItem) => {
      const exists = favorites.some((fav) => fav.text.toLowerCase() === item.text.toLowerCase());
      if (exists) return;
      const entry: SavedItem = {
        ...item,
        sourceHook: hook,
        targetAudience,
        platform,
        stylePreset,
        savedAt: new Date().toISOString(),
      };
      setFavorites((prev) => [entry, ...prev]);
    },
    [favorites, hook, platform, stylePreset, targetAudience],
  );

  const createCollection = useCallback(() => {
    const name = collectionNameInput.trim();
    if (!name) return;
    const duplicate = collections.some((c) => c.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      setError("Collection with that name already exists.");
      return;
    }
    const next: Collection = { id: makeId(), name, items: [] };
    setCollections((prev) => [next, ...prev]);
    setActiveCollectionId(next.id);
    setCollectionNameInput("");
    setError(null);
  }, [collectionNameInput, collections]);

  const addToCollection = useCallback(
    (item: ResultItem) => {
      if (!activeCollectionId) {
        setError("Choose or create a collection first.");
        return;
      }
      const payload: SavedItem = {
        ...item,
        sourceHook: hook,
        targetAudience,
        platform,
        stylePreset,
        savedAt: new Date().toISOString(),
      };
      setCollections((prev) =>
        prev.map((collection) => {
          if (collection.id !== activeCollectionId) return collection;
          const exists = collection.items.some((entry) => entry.text.toLowerCase() === payload.text.toLowerCase());
          if (exists) return collection;
          return { ...collection, items: [payload, ...collection.items] };
        }),
      );
      setError(null);
    },
    [activeCollectionId, hook, platform, stylePreset, targetAudience],
  );

  const onRewriteFromWinner = useCallback(
    async (item: ResultItem) => {
      setError(null);
      setRewritingId(item.id);
      const apiKey = loadSharedOpenAiKey();
      try {
        const hooks = await rewriteWinningHook({
          apiKey,
          targetAudience,
          hook,
          winningHook: item.text,
          platform,
          stylePreset,
          curiosityLevel,
          useContrarianHook,
          useBrandVoiceLock,
          brandVoiceSample,
          uniquePerspective,
          instructions: hookTransformInstructions,
        });
        setResults(toResultItems(hooks));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to rewrite from winner.");
      } finally {
        setRewritingId(null);
      }
    },
    [brandVoiceSample, curiosityLevel, hook, platform, stylePreset, targetAudience, uniquePerspective, useBrandVoiceLock, useContrarianHook],
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
          targetAudience,
          platform,
          hook: item.text,
          uniquePerspective,
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
    [platform, targetAudience, uniquePerspective],
  );

  const onExpandWinningHook = useCallback(
    async (item: ResultItem) => {
      setError(null);
      setExpandingId(item.id);
      const apiKey = loadSharedOpenAiKey();
      try {
        const pack = await generateWinningHookExpansion({
          apiKey,
          targetAudience,
          platform,
          stylePreset,
          uniquePerspective,
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
    [platform, stylePreset, targetAudience, uniquePerspective],
  );

  const onCreateScriptStoryboard = useCallback(
    async (item: ResultItem) => {
      setError(null);
      setScriptLoadingId(item.id);
      const apiKey = loadSharedOpenAiKey();
      try {
        const pkg = await generateScriptStoryboard({
          apiKey,
          platform,
          targetAudience,
          useBrandVoiceLock,
          brandVoiceSample,
          uniquePerspective,
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
    [brandVoiceSample, platform, targetAudience, uniquePerspective, useBrandVoiceLock],
  );

  const onNetflixify = useCallback(
    async (hookText: string, loadingId: string) => {
      setError(null);
      setNetflixifyLoadingId(loadingId);
      setActiveView("script");
      const apiKey = loadSharedOpenAiKey();
      const seedHook = hookText.trim();
      if (!seedHook) {
        setError("Enter a hook first to Netflixify.");
        setNetflixifyLoadingId(null);
        return;
      }
      try {
        const scripts = await generateNetflixifyScripts({
          apiKey,
          platform,
          targetAudience,
          curiosityLevel,
          useContrarianHook,
          conflictLevel: netflixConflictLevel,
          dramaLevel: netflixDramaLevel,
          endingStyle: netflixEndingStyle,
          useBrandVoiceLock,
          brandVoiceSample,
          uniquePerspective,
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
      brandVoiceSample,
      curiosityLevel,
      netflixConflictLevel,
      netflixDramaLevel,
      netflixEndingStyle,
      platform,
      targetAudience,
      uniquePerspective,
      useBrandVoiceLock,
      useContrarianHook,
    ],
  );

  const onUpdateHookText = useCallback((id: string, text: string) => {
    setResults((prev) => prev.map((item) => (item.id === id ? { ...item, text } : item)));
  }, []);

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

  const onDesignCarouselFromText = useCallback(
    (sourceText: string, namePrefix: string) => {
      const baseText = sourceText.trim();
      if (!baseText) return;
      const primaryLayoutId = carouselLayouts[0]?.id ?? "layout-minimal";
      const draft: CarouselDraft = {
        id: makeId(),
        name: `${namePrefix} ${new Date().toLocaleTimeString()}`,
        createdAt: new Date().toISOString(),
        slides: buildSlidesFromText(baseText, primaryLayoutId),
      };
      setCarouselDrafts((prev) => [draft, ...prev]);
      setActiveCarouselId(draft.id);
      setActiveView("carousel");
    },
    [carouselLayouts],
  );

  const activeCollection = useMemo(
    () => collections.find((collection) => collection.id === activeCollectionId),
    [activeCollectionId, collections],
  );
  const activeCarouselDraft = useMemo(
    () => carouselDrafts.find((draft) => draft.id === activeCarouselId) ?? carouselDrafts[0],
    [activeCarouselId, carouselDrafts],
  );
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
        <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center justify-between gap-3">
          <div>
            <input
              value={lighthouseHeadline}
              onChange={(e) => setLighthouseHeadline(e.target.value)}
              className="w-full max-w-4xl border-none bg-transparent text-2xl font-semibold leading-tight outline-none sm:text-3xl"
              style={{ color: "var(--text-primary)" }}
            />
            <p className="mt-0.5 max-w-xl text-xs text-[var(--text-tertiary)]">
              Ten variations that weave in who it is for, their situation, and the problem without sounding mechanical.
            </p>
          </div>
          <div className="flex items-center gap-2">
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

      <div className="mx-auto grid h-[calc(100vh-86px)] w-full max-w-[1600px] gap-4 overflow-hidden p-3 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside
          className="h-full overflow-hidden rounded-2xl border p-4"
          style={{
            borderColor: "var(--border-subtle)",
            background: "var(--bg-elevated)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Inputs</h2>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Platform</span>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as (typeof PLATFORMS)[number])}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
              }}
            >
              {PLATFORMS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Style preset</span>
            <select
              value={stylePreset}
              onChange={(e) => setStylePreset(e.target.value as (typeof STYLE_PRESETS)[number])}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
              }}
            >
              {STYLE_PRESETS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Target audience</span>
            <textarea
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-xl border px-3 py-2.5 text-sm outline-none transition-shadow focus:ring-2"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                boxShadow: "none",
              }}
            />
          </label>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Hook</span>
            <textarea
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              rows={5}
              placeholder="Can't switch off your thoughts?"
              className="w-full resize-y rounded-xl border px-3 py-2.5 text-sm outline-none transition-shadow focus:ring-2"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
              }}
            />
          </label>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Unique perspective</span>
            <textarea
              value={uniquePerspective}
              onChange={(e) => setUniquePerspective(e.target.value)}
              rows={3}
              placeholder="Optional: Contrarian angle, uncommon insight, or specific belief"
              className="w-full resize-y rounded-xl border px-3 py-2.5 text-sm outline-none transition-shadow focus:ring-2"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
              }}
            />
          </label>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              Curiosity level: {curiosityLevel.toFixed(2)}
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
            Use contrarian hook
          </label>
          <label className="mt-4 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={useBrandVoiceLock}
              onChange={(e) => setUseBrandVoiceLock(e.target.checked)}
            />
            Brand voice lock
          </label>
          {useBrandVoiceLock ? (
            <label className="mt-2 block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Brand voice sample</span>
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
          <div className="mt-4 rounded-xl border p-3" style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)" }}>
            <p className="text-sm font-medium text-[var(--text-secondary)]">Netflixify controls</p>
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
            className="mt-5 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: "var(--accent-gradient)", boxShadow: "var(--shadow-sm)" }}
          >
            {loading ? loadingLabel : "Generate 10 versions"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void onFindTrendingHooks()}
            className="mt-3 w-full rounded-xl border px-4 py-3 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderColor: "var(--border-default)",
              background: "var(--bg-tertiary)",
              color: "var(--text-secondary)",
            }}
          >
            {loading && loadingLabel === "Finding trends..." ? "Finding trends..." : "Find trending hooks"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void onRecalculateScores()}
            className="mt-3 w-full rounded-xl border px-4 py-3 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderColor: "var(--border-default)",
              background: "var(--bg-tertiary)",
              color: "var(--text-secondary)",
            }}
          >
            {loading && loadingLabel === "Recalculating scores..." ? "Recalculating scores..." : "Recalculate hook scores"}
          </button>
          <button
            type="button"
            disabled={netflixifyLoadingId === "input-hook"}
            onClick={() => void onNetflixify(hook, "input-hook")}
            className="mt-3 w-full rounded-xl border px-4 py-3 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderColor: "var(--border-default)",
              background: "var(--bg-tertiary)",
              color: "var(--text-secondary)",
            }}
          >
            {netflixifyLoadingId === "input-hook" ? "Netflixifying..." : "Netflixify"}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-[var(--text-tertiary)]">
            Uses your shared OpenAI key from the hub (local <code className="rounded bg-[var(--bg-hover)] px-1">saasApiKeys</code>). Add
            it via the gear icon on the SaaS Apps page if needed.
          </p>
          {error ? (
            <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>
          ) : null}
        </aside>

        <section className="h-full overflow-y-auto pr-1 text-base">
          <div
            className="sticky top-0 z-20 mb-3 flex flex-wrap gap-2 border-b pb-2"
            style={{ borderColor: "var(--border-subtle)", background: "var(--bg-primary)" }}
          >
            {VIEWS.map((view) => {
              const label =
                view === "variants"
                  ? "Variants"
                  : view === "aha"
                    ? "Aha + conclusion"
                    : view === "script"
                      ? "Script"
                      : "Carousel";
              const isActive = activeView === view;
              return (
                <button
                  key={view}
                  type="button"
                  onClick={() => setActiveView(view)}
                  className="rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors"
                  style={{
                    borderColor: "var(--border-default)",
                    background: isActive ? "var(--bg-elevated)" : "var(--bg-tertiary)",
                    color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {activeView === "variants" ? (
            <>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Variations</h2>
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
                <div className="grid gap-2 2xl:grid-cols-3">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-20 animate-pulse rounded-2xl border"
                      style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}
                    />
                  ))}
                </div>
              ) : null}
              {!loading && results.length > 0 ? (
                <ul className="grid list-none gap-2 p-0">
                  {results.map((item, i) => (
                    <li
                      key={item.id}
                      className="flex flex-col rounded-xl border p-2.5"
                      style={{
                        borderColor: "var(--border-subtle)",
                        background: "var(--bg-elevated)",
                        boxShadow: "var(--shadow-sm)",
                      }}
                    >
                      <span className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                        #{i + 1}
                        {item.source ? (
                          <span className="ml-2 rounded-md border px-1.5 py-0.5 text-[10px]" style={{ borderColor: "var(--border-default)" }}>
                            {item.source}
                          </span>
                        ) : null}
                      </span>
                      <textarea
                        value={item.text}
                        onChange={(e) => onUpdateHookText(item.id, e.target.value)}
                        rows={1}
                        className="flex-1 w-full resize-y px-0.5 py-0.5 text-lg font-medium leading-snug outline-none sm:text-xl"
                        style={{
                          color: "var(--text-secondary)",
                        }}
                      />
                      <div className="group mt-1.5 px-0.5 py-0.5 text-xs">
                        <p className="font-semibold text-[var(--text-primary)]">Hook score: {item.score}/100</p>
                        <p className="mt-0.5 font-semibold text-[var(--text-primary)]">Performance prediction: {item.performanceScore}/100</p>
                        <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{item.performanceReason}</p>
                        <ul className="mt-0.5 list-disc pl-4 text-xs text-[var(--text-secondary)]">
                          {item.reasons.map((reason, idx) => (
                            <li key={`${item.id}-reason-${idx}`}>{reason}</li>
                          ))}
                        </ul>
                        <p className="mt-1 hidden px-1 py-0.5 text-[11px] text-[var(--text-tertiary)] group-hover:block">
                          To score higher: {item.improveTip}
                        </p>
                      </div>
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
                          className="rounded-md border px-2 py-0.5 text-xs font-medium transition-colors"
                          style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                          title="Add hook to selected collection"
                          aria-label="Add hook to selected collection"
                          onClick={() => addToCollection(item)}
                        >
                          🗂️
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
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}>
                  <h3 className="text-sm font-semibold">Favorites ({favorites.length})</h3>
                  <div className="mt-2 max-h-48 space-y-2 overflow-auto text-xs text-[var(--text-secondary)]">
                    {favorites.length === 0 ? <p className="text-[var(--text-tertiary)]">No favorites yet.</p> : null}
                    {favorites.map((item) => (
                      <p key={item.id}>{item.text}</p>
                    ))}
                  </div>
                </section>
                <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}>
                  <h3 className="text-sm font-semibold">Collections</h3>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={collectionNameInput}
                      onChange={(e) => setCollectionNameInput(e.target.value)}
                      placeholder="New collection name"
                      className="w-full rounded-lg border px-3 py-2 text-xs"
                      style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                    />
                    <button
                      type="button"
                      onClick={createCollection}
                      className="rounded-lg border px-3 py-2 text-xs"
                      style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                    >
                      Create
                    </button>
                  </div>
                  <select
                    value={activeCollectionId}
                    onChange={(e) => setActiveCollectionId(e.target.value)}
                    className="mt-2 w-full rounded-lg border px-3 py-2 text-xs"
                    style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                  >
                    <option value="">Select collection</option>
                    {collections.map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.name} ({collection.items.length})
                      </option>
                    ))}
                  </select>
                  <div className="mt-2 max-h-40 space-y-2 overflow-auto text-xs text-[var(--text-secondary)]">
                    {activeCollection?.items.length ? (
                      activeCollection.items.map((item) => <p key={item.id}>{item.text}</p>)
                    ) : (
                      <p className="text-[var(--text-tertiary)]">No saved hooks in this collection.</p>
                    )}
                  </div>
                </section>
              </div>
            </>
          ) : null}

          {activeView === "aha" ? (
            <>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Aha + conclusion</h2>
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
              <h2 className="text-base font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Script</h2>
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
                                  Design carousel
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
                            Design carousel
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
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Carousel</h2>
              <div className="mt-4 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                <section className="rounded-xl border p-3" style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)" }}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-[var(--text-primary)]">Carousels ({carouselDrafts.length})</h3>
                    <button
                      type="button"
                      className="rounded-md border px-2 py-1 text-[11px]"
                      style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
                      onClick={createCarouselDraft}
                    >
                      New
                    </button>
                  </div>
                  <div className="mt-2 space-y-2">
                    {carouselDrafts.length === 0 ? (
                      <p className="text-xs text-[var(--text-tertiary)]">Create a carousel, add slides, then edit text and layout.</p>
                    ) : (
                      carouselDrafts.map((draft) => (
                        <button
                          key={draft.id}
                          type="button"
                          onClick={() => setActiveCarouselId(draft.id)}
                          className="w-full rounded-lg border px-2 py-2 text-left text-xs"
                          style={{
                            borderColor: "var(--border-default)",
                            background: activeCarouselDraft?.id === draft.id ? "var(--bg-elevated)" : "var(--bg-tertiary)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          <p className="font-semibold text-[var(--text-primary)]">{draft.name}</p>
                          <p>{draft.slides.length} slides</p>
                        </button>
                      ))
                    )}
                  </div>
                </section>

                <section className="space-y-4">
                  {activeCarouselDraft ? (
                    <div className="rounded-xl border p-3" style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)" }}>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={activeCarouselDraft.name}
                          onChange={(e) => updateCarouselDraftName(activeCarouselDraft.id, e.target.value)}
                          className="min-w-[220px] flex-1 rounded-lg border px-3 py-2 text-sm"
                          style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)", color: "var(--text-primary)" }}
                        />
                        <button
                          type="button"
                          onClick={() => addCarouselSlide(activeCarouselDraft.id)}
                          className="rounded-lg border px-3 py-2 text-xs"
                          style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
                        >
                          Add slide
                        </button>
                      </div>

                      <div className="mt-4 space-y-3">
                        {activeCarouselDraft.slides.map((slide, idx) => {
                          const selectedLayout =
                            carouselLayouts.find((layout) => layout.id === slide.layoutId) ?? carouselLayouts[0] ?? getDefaultCarouselLayouts()[0];
                          const tone = slide.tone ?? "soft";
                          const textAlign = slide.textAlign ?? "left";
                          const alignClass = textAlign === "center" ? "text-center" : "text-left";
                          const toneBackground =
                            tone === "dark"
                              ? "var(--bg-primary)"
                              : tone === "accent"
                                ? "#fff6d8"
                                : "#ffffff";
                          return (
                            <div key={slide.id} className="rounded-xl border p-3" style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)" }}>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Slide #{idx + 1}</p>
                              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                                Click text inside the slide canvas to edit it directly.
                              </p>
                              <select
                                value={slide.layoutId}
                                onChange={(e) => updateCarouselSlide(activeCarouselDraft.id, slide.id, { layoutId: e.target.value })}
                                className="mt-2 w-full rounded-lg border px-3 py-2 text-xs"
                                style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                              >
                                {carouselLayouts.map((layout) => (
                                  <option key={layout.id} value={layout.id}>
                                    {layout.name}
                                  </option>
                                ))}
                              </select>
                              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                <select
                                  value={textAlign}
                                  onChange={(e) =>
                                    updateCarouselSlide(activeCarouselDraft.id, slide.id, {
                                      textAlign: e.target.value as "left" | "center",
                                    })
                                  }
                                  className="w-full rounded-lg border px-3 py-2 text-xs"
                                  style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                                >
                                  <option value="left">Left align</option>
                                  <option value="center">Center align</option>
                                </select>
                                <select
                                  value={tone}
                                  onChange={(e) =>
                                    updateCarouselSlide(activeCarouselDraft.id, slide.id, {
                                      tone: e.target.value as "soft" | "dark" | "accent",
                                    })
                                  }
                                  className="w-full rounded-lg border px-3 py-2 text-xs"
                                  style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                                >
                                  <option value="soft">Soft tone</option>
                                  <option value="accent">Accent tone</option>
                                  <option value="dark">Dark tone</option>
                                </select>
                              </div>

                              <div className="mt-3 rounded-xl border p-2" style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)" }}>
                                <p className="text-[11px] text-[var(--text-tertiary)]">Canvas size: 1080 x 1440</p>
                                <div className="mt-2 flex justify-center">
                                  <div
                                    className="aspect-[3/4] w-full max-w-[320px] overflow-hidden rounded-2xl border shadow-sm"
                                    style={{ borderColor: "var(--border-default)", background: toneBackground }}
                                  >
                                    <div className={`flex h-full w-full flex-col justify-center p-8 ${selectedLayout.cardClass} ${alignClass}`}>
                                      <p
                                        className={`${selectedLayout.titleClass} cursor-text`}
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={(e) =>
                                          updateCarouselSlide(activeCarouselDraft.id, slide.id, {
                                            headline: e.currentTarget.innerText.trim(),
                                          })
                                        }
                                      >
                                        {slide.headline || "Headline preview"}
                                      </p>
                                      <p
                                        className={`${selectedLayout.bodyClass} cursor-text`}
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={(e) =>
                                          updateCarouselSlide(activeCarouselDraft.id, slide.id, {
                                            body: e.currentTarget.innerText.trim(),
                                          })
                                        }
                                      >
                                        {slide.body || "Body preview"}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed p-4 text-xs text-[var(--text-tertiary)]" style={{ borderColor: "var(--border-default)" }}>
                      No carousel selected. Create one from the panel on the left.
                    </div>
                  )}

                  <div className="rounded-xl border p-3" style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)" }}>
                    <h3 className="text-xs font-semibold text-[var(--text-primary)]">Layout library</h3>
                    <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                      Editing layouts updates all slides that use those layouts, including future carousels.
                    </p>
                    <div className="mt-3 space-y-3">
                      {carouselLayouts.map((layout) => (
                        <div key={layout.id} className="rounded-lg border p-2" style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)" }}>
                          <input
                            value={layout.name}
                            onChange={(e) => updateCarouselLayout(layout.id, { name: e.target.value })}
                            className="w-full rounded-md border px-2 py-1 text-xs"
                            style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                          />
                          <input
                            value={layout.titleClass}
                            onChange={(e) => updateCarouselLayout(layout.id, { titleClass: e.target.value })}
                            className="mt-2 w-full rounded-md border px-2 py-1 text-[11px]"
                            style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                          />
                          <input
                            value={layout.bodyClass}
                            onChange={(e) => updateCarouselLayout(layout.id, { bodyClass: e.target.value })}
                            className="mt-2 w-full rounded-md border px-2 py-1 text-[11px]"
                            style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                          />
                          <input
                            value={layout.cardClass}
                            onChange={(e) => updateCarouselLayout(layout.id, { cardClass: e.target.value })}
                            className="mt-2 w-full rounded-md border px-2 py-1 text-[11px]"
                            style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}

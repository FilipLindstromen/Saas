"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import hookTransformInstructions from "@/data/hook-transform-instructions.json";
import {
  type ExpansionPack,
  type ScriptStoryboard,
  generateContentIdeas,
  generateHookVariations,
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
  const [targetAudience, setTargetAudience] = useState(DEFAULT_AUDIENCE);
  const [hook, setHook] = useState("");
  const [uniquePerspective, setUniquePerspective] = useState("");
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Generating...");
  const [rewritingId, setRewritingId] = useState<string | null>(null);
  const [ideasLoadingId, setIdeasLoadingId] = useState<string | null>(null);
  const [expandingId, setExpandingId] = useState<string | null>(null);
  const [scriptLoadingId, setScriptLoadingId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        targetAudience: string;
        hook: string;
        uniquePerspective: string;
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
      }>;
      if (typeof parsed.targetAudience === "string") setTargetAudience(parsed.targetAudience);
      if (typeof parsed.hook === "string") setHook(parsed.hook);
      if (typeof parsed.uniquePerspective === "string") setUniquePerspective(parsed.uniquePerspective);
      if (parsed.platform && PLATFORMS.includes(parsed.platform)) setPlatform(parsed.platform);
      if (parsed.stylePreset && STYLE_PRESETS.includes(parsed.stylePreset)) setStylePreset(parsed.stylePreset);
      if (Array.isArray(parsed.results)) {
        const normalized = parsed.results.map((item) => ({
          ...item,
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
    } catch {
      // ignore invalid local storage payload
    }
  }, []);

  useEffect(() => {
    const payload = {
      targetAudience,
      hook,
      uniquePerspective,
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
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [
    targetAudience,
    hook,
    uniquePerspective,
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
  ]);

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
        uniquePerspective,
        instructions: hookTransformInstructions,
      });
      setResults(toResultItems(hooks));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [hook, platform, stylePreset, targetAudience, uniquePerspective]);

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
  }, [platform, results, targetAudience]);

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
        uniquePerspective,
      });
      setResults(toResultItems(hooks));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to find trending hooks.");
    } finally {
      setLoading(false);
      setLoadingLabel("Generating...");
    }
  }, [hook, stylePreset, targetAudience, uniquePerspective]);

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
    [hook, platform, stylePreset, targetAudience, uniquePerspective],
  );

  const onGenerateIdeas = useCallback(
    async (item: ResultItem) => {
      setError(null);
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
    [platform, targetAudience, uniquePerspective],
  );

  const onUpdateHookText = useCallback((id: string, text: string) => {
    setResults((prev) => prev.map((item) => (item.id === id ? { ...item, text } : item)));
  }, []);

  const activeCollection = useMemo(
    () => collections.find((collection) => collection.id === activeCollectionId),
    [activeCollectionId, collections],
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
            <h1 className="text-lg font-semibold sm:text-xl">Hook Transformer</h1>
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

      <div className="mx-auto grid h-[calc(100vh-86px)] w-full max-w-[1800px] gap-6 overflow-hidden p-4 xl:grid-cols-[340px_minmax(0,1fr)_380px]">
        <aside
          className="h-full overflow-hidden rounded-2xl border p-5"
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
          <p className="mt-3 text-xs leading-relaxed text-[var(--text-tertiary)]">
            Uses your shared OpenAI key from the hub (local <code className="rounded bg-[var(--bg-hover)] px-1">saasApiKeys</code>). Add
            it via the gear icon on the SaaS Apps page if needed.
          </p>
          {error ? (
            <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>
          ) : null}
        </aside>

        <section className="h-full overflow-y-auto pr-1">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Variations</h2>
          {results.length === 0 && !loading ? (
            <div
              className="rounded-2xl border border-dashed p-10 text-center text-sm text-[var(--text-tertiary)]"
              style={{ borderColor: "var(--border-default)", background: "var(--bg-secondary)" }}
            >
              Generated hooks appear here. Instructions live in{" "}
              <code className="rounded bg-[var(--bg-hover)] px-1 text-[var(--text-secondary)]">src/data/hook-transform-instructions.json</code>.
            </div>
          ) : null}
          {loading ? (
            <div className="grid gap-3 2xl:grid-cols-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-2xl border"
                  style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}
                />
              ))}
            </div>
          ) : null}
          {!loading && results.length > 0 ? (
            <ul className="grid list-none gap-3 p-0 2xl:grid-cols-2">
              {results.map((item, i) => (
                <li
                  key={item.id}
                  className="flex flex-col rounded-2xl border p-4"
                  style={{
                    borderColor: "var(--border-subtle)",
                    background: "var(--bg-elevated)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <span className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
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
                    rows={3}
                    className="flex-1 w-full resize-y rounded-lg border px-2.5 py-2 text-sm leading-relaxed outline-none"
                    style={{
                      borderColor: "var(--border-default)",
                      background: "var(--bg-tertiary)",
                      color: "var(--text-secondary)",
                    }}
                  />
                  <div
                    className="group mt-3 rounded-lg border px-3 py-2 text-xs"
                    style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)" }}
                  >
                    <p className="font-semibold text-[var(--text-primary)]">Hook score: {item.score}/100</p>
                    <ul className="mt-1 list-disc pl-4 text-[var(--text-secondary)]">
                      {item.reasons.map((reason, idx) => (
                        <li key={`${item.id}-reason-${idx}`}>{reason}</li>
                      ))}
                    </ul>
                    <p className="mt-2 hidden rounded-md border px-2 py-1 text-[11px] text-[var(--text-tertiary)] group-hover:block" style={{ borderColor: "var(--border-default)" }}>
                      To score higher: {item.improveTip}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
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
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                      style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                      title="Save hook to favorites"
                      aria-label="Save hook to favorites"
                      onClick={() => addToFavorites(item)}
                    >
                      ⭐
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
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
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60"
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
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60"
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
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60"
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
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60"
                      style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                      title="Create script and storyboard from hook"
                      aria-label="Create script and storyboard from hook"
                      onClick={() => void onCreateScriptStoryboard(item)}
                    >
                      {scriptLoadingId === item.id ? "⏳" : "🎬"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
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
        </section>

        <aside
          className="h-full overflow-hidden rounded-2xl border p-4"
          style={{
            borderColor: "var(--border-subtle)",
            background: "var(--bg-elevated)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Aha + conclusion</h2>
          <p className="mt-2 text-xs text-[var(--text-tertiary)]">
            Click <span className="font-medium text-[var(--text-secondary)]">💡</span> on any hook to load 5 aha + conclusion examples here.
          </p>

          <div className="mt-4 rounded-xl border p-3" style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)" }}>
            <h3 className="text-xs font-semibold text-[var(--text-primary)]">Favorite ideas ({favoriteIdeas.length})</h3>
            <div className="mt-2 space-y-2">
              {favoriteIdeas.length === 0 ? (
                <p className="text-xs text-[var(--text-tertiary)]">No favorite ideas saved yet.</p>
              ) : (
                favoriteIdeas.map((idea) => (
                  <div key={idea.id} className="rounded-lg border p-2 text-xs" style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)" }}>
                    <p className="text-[var(--text-secondary)]">{idea.text}</p>
                    <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">{idea.platform} · {idea.hookText}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 space-y-3 pr-1">
            {ideaBatches.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-xs text-[var(--text-tertiary)]" style={{ borderColor: "var(--border-default)" }}>
                Aha + conclusion examples appear here in separate cards so you can favorite each one.
              </div>
            ) : (
              ideaBatches.map((batch) => (
                <section key={batch.id} className="rounded-xl border p-3" style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)" }}>
                  <p className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
                    {batch.platform} · {batch.targetAudience}
                  </p>
                  <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">{batch.hookText}</p>
                  <div className="mt-2 space-y-2">
                    {batch.ideas.map((idea) => {
                      const saved = isIdeaFavorited(idea, batch);
                      return (
                        <div key={idea.id} className="rounded-lg border p-2 text-xs" style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)" }}>
                          <p className="text-[var(--text-secondary)]">{idea.text}</p>
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

          <div className="mt-4 rounded-xl border p-3" style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)" }}>
            <h3 className="text-xs font-semibold text-[var(--text-primary)]">Winning hook expansions ({expansionBatches.length})</h3>
            <div className="mt-2 space-y-3">
              {expansionBatches.length === 0 ? (
                <p className="text-xs text-[var(--text-tertiary)]">Run "Winning hook expansion" on a result to generate rewrite/pain/curiosity sets.</p>
              ) : (
                expansionBatches.map((batch) => (
                  <div key={batch.id} className="rounded-lg border p-2 text-xs" style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)" }}>
                    <p className="font-medium text-[var(--text-secondary)]">{batch.hookText}</p>
                    <div className="mt-2 space-y-2 text-[11px] text-[var(--text-tertiary)]">
                      <div>
                        <p className="font-semibold text-[var(--text-secondary)]">Rewrites</p>
                        <p>{batch.groups.rewrites.slice(0, 3).map((h) => h.text).join(" · ")}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--text-secondary)]">Pain hooks</p>
                        <p>{batch.groups.painHooks.slice(0, 3).map((h) => h.text).join(" · ")}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--text-secondary)]">Curiosity hooks</p>
                        <p>{batch.groups.curiosityHooks.slice(0, 3).map((h) => h.text).join(" · ")}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 rounded-xl border p-3" style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)" }}>
            <h3 className="text-xs font-semibold text-[var(--text-primary)]">Scripts & storyboards ({scriptBoards.length})</h3>
            <div className="mt-2 space-y-3">
              {scriptBoards.length === 0 ? (
                <p className="text-xs text-[var(--text-tertiary)]">Run "1-click script/storyboard" on any hook to create a ready-to-record plan.</p>
              ) : (
                scriptBoards.map((entry) => (
                  <div key={entry.id} className="rounded-lg border p-2 text-xs" style={{ borderColor: "var(--border-default)", background: "var(--bg-elevated)" }}>
                    <p className="font-semibold text-[var(--text-secondary)]">{entry.package.title}</p>
                    <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">{entry.platform} · {entry.hookText}</p>
                    <p className="mt-2 text-[11px] text-[var(--text-secondary)]">{entry.package.script}</p>
                    <div className="mt-2">
                      <p className="font-semibold text-[var(--text-secondary)]">Storyboard</p>
                      <ul className="list-disc pl-4 text-[11px] text-[var(--text-tertiary)]">
                        {entry.package.storyboard.map((step, idx) => (
                          <li key={`${entry.id}-step-${idx}`}>{step}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-2">
                      <p className="font-semibold text-[var(--text-secondary)]">CTA options</p>
                      <ul className="list-disc pl-4 text-[11px] text-[var(--text-tertiary)]">
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
        </aside>
      </div>
    </div>
  );
}

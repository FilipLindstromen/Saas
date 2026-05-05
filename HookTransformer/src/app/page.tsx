"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import hookTransformInstructions from "@/data/hook-transform-instructions.json";
import { generateContentIdeas, generateHookVariations, rewriteWinningHook, type HookVariation } from "@/lib/generate-hooks";
import { loadSharedOpenAiKey } from "@/lib/saas-api-keys";
import { ThemeToggle } from "@/components/theme-toggle";

const DEFAULT_AUDIENCE = "High-performing professionals";
const STORAGE_KEY = "hook-transformer-state-v2";
const PLATFORMS = ["Instagram Reel", "Instagram Carousel", "TikTok", "YouTube Shorts"] as const;
const STYLE_PRESETS = ["Casual", "Direct", "Curious", "Bold", "Empathetic"] as const;

type ResultItem = HookVariation & {
  id: string;
  contentIdeas: string[];
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

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toResultItems(hooks: HookVariation[]): ResultItem[] {
  return hooks.map((item) => ({
    ...item,
    id: makeId(),
    contentIdeas: [],
  }));
}

export default function HomePage() {
  const [targetAudience, setTargetAudience] = useState(DEFAULT_AUDIENCE);
  const [hook, setHook] = useState("");
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>("Instagram Reel");
  const [stylePreset, setStylePreset] = useState<(typeof STYLE_PRESETS)[number]>("Casual");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [favorites, setFavorites] = useState<SavedItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string>("");
  const [collectionNameInput, setCollectionNameInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rewritingId, setRewritingId] = useState<string | null>(null);
  const [ideasLoadingId, setIdeasLoadingId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        targetAudience: string;
        hook: string;
        platform: (typeof PLATFORMS)[number];
        stylePreset: (typeof STYLE_PRESETS)[number];
        results: ResultItem[];
        favorites: SavedItem[];
        collections: Collection[];
        activeCollectionId: string;
      }>;
      if (typeof parsed.targetAudience === "string") setTargetAudience(parsed.targetAudience);
      if (typeof parsed.hook === "string") setHook(parsed.hook);
      if (parsed.platform && PLATFORMS.includes(parsed.platform)) setPlatform(parsed.platform);
      if (parsed.stylePreset && STYLE_PRESETS.includes(parsed.stylePreset)) setStylePreset(parsed.stylePreset);
      if (Array.isArray(parsed.results)) setResults(parsed.results);
      if (Array.isArray(parsed.favorites)) setFavorites(parsed.favorites);
      if (Array.isArray(parsed.collections)) setCollections(parsed.collections);
      if (typeof parsed.activeCollectionId === "string") setActiveCollectionId(parsed.activeCollectionId);
    } catch {
      // ignore invalid local storage payload
    }
  }, []);

  useEffect(() => {
    const payload = {
      targetAudience,
      hook,
      platform,
      stylePreset,
      results,
      favorites,
      collections,
      activeCollectionId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [targetAudience, hook, platform, stylePreset, results, favorites, collections, activeCollectionId]);

  const onGenerate = useCallback(async () => {
    setError(null);
    setResults([]);
    const apiKey = loadSharedOpenAiKey();
    if (!hook.trim()) {
      setError("Enter a hook to transform.");
      return;
    }
    setLoading(true);
    try {
      const hooks = await generateHookVariations({
        apiKey,
        targetAudience,
        hook,
        platform,
        stylePreset,
        instructions: hookTransformInstructions,
      });
      setResults(toResultItems(hooks));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [hook, platform, stylePreset, targetAudience]);

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
          instructions: hookTransformInstructions,
        });
        setResults(toResultItems(hooks));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to rewrite from winner.");
      } finally {
        setRewritingId(null);
      }
    },
    [hook, platform, stylePreset, targetAudience],
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
        });
        setResults((prev) => prev.map((row) => (row.id === item.id ? { ...row, contentIdeas: ideas } : row)));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to generate content ideas.");
      } finally {
        setIdeasLoadingId(null);
      }
    },
    [platform, targetAudience],
  );

  const activeCollection = useMemo(
    () => collections.find((collection) => collection.id === activeCollectionId),
    [activeCollectionId, collections],
  );

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <header
        className="border-b px-4 py-4 sm:px-6"
        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-secondary)" }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
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

      <div className="mx-auto grid max-w-6xl gap-6 p-4 sm:grid-cols-[minmax(280px,360px)_1fr] sm:gap-8 sm:p-6">
        <aside
          className="h-fit rounded-2xl border p-5 sm:sticky sm:top-6"
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
          <button
            type="button"
            disabled={loading}
            onClick={onGenerate}
            className="mt-5 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: "var(--accent-gradient)", boxShadow: "var(--shadow-sm)" }}
          >
            {loading ? "Generating..." : "Generate 10 versions"}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-[var(--text-tertiary)]">
            Uses your shared OpenAI key from the hub (local <code className="rounded bg-[var(--bg-hover)] px-1">saasApiKeys</code>). Add
            it via the gear icon on the SaaS Apps page if needed.
          </p>
          {error ? (
            <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>
          ) : null}
        </aside>

        <section>
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
            <div className="grid gap-3 sm:grid-cols-2">
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
            <ul className="grid list-none gap-3 p-0 sm:grid-cols-2">
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
                  </span>
                  <p className="flex-1 text-sm leading-relaxed text-[var(--text-secondary)]">{item.text}</p>
                  <div className="mt-3 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)" }}>
                    <p className="font-semibold text-[var(--text-primary)]">Hook score: {item.score}/100</p>
                    <ul className="mt-1 list-disc pl-4 text-[var(--text-secondary)]">
                      {item.reasons.map((reason, idx) => (
                        <li key={`${item.id}-reason-${idx}`}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                      style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                      onClick={() => {
                        void navigator.clipboard.writeText(item.text);
                      }}
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                      style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                      onClick={() => addToFavorites(item)}
                    >
                      Favorite
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                      style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                      onClick={() => addToCollection(item)}
                    >
                      Add to collection
                    </button>
                    <button
                      type="button"
                      disabled={rewritingId === item.id}
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60"
                      style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                      onClick={() => void onRewriteFromWinner(item)}
                    >
                      {rewritingId === item.id ? "Rewriting..." : "Rewrite from winner"}
                    </button>
                    <button
                      type="button"
                      disabled={ideasLoadingId === item.id}
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60"
                      style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                      onClick={() => void onGenerateIdeas(item)}
                    >
                      {ideasLoadingId === item.id ? "Generating ideas..." : "Create 5 content ideas"}
                    </button>
                  </div>
                  {item.contentIdeas.length > 0 ? (
                    <div className="mt-3 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "var(--border-default)", background: "var(--bg-tertiary)" }}>
                      <p className="font-semibold text-[var(--text-primary)]">Content ideas</p>
                      <ul className="mt-1 list-disc pl-4 text-[var(--text-secondary)]">
                        {item.contentIdeas.map((idea, idx) => (
                          <li key={`${item.id}-idea-${idx}`}>{idea}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
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
      </div>
    </div>
  );
}

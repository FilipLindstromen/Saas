"use client";

import { useCallback, useState } from "react";
import hookTransformInstructions from "@/data/hook-transform-instructions.json";
import { generateHookVariations } from "@/lib/generate-hooks";
import { loadSharedOpenAiKey } from "@/lib/saas-api-keys";
import { ThemeToggle } from "@/components/theme-toggle";

const DEFAULT_AUDIENCE = "High-performing professionals";

export default function HomePage() {
  const [targetAudience, setTargetAudience] = useState(DEFAULT_AUDIENCE);
  const [hook, setHook] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        instructions: hookTransformInstructions,
      });
      setResults(hooks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [hook, targetAudience]);

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
              Ten variations that weave in who it is for, their situation, and the problem—without sounding mechanical.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/"
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
            {loading ? "Generating…" : "Generate 10 versions"}
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
              {results.map((line, i) => (
                <li
                  key={`${i}-${line.slice(0, 24)}`}
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
                  <p className="flex-1 text-sm leading-relaxed text-[var(--text-secondary)]">{line}</p>
                  <button
                    type="button"
                    className="mt-3 self-start rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                    style={{
                      borderColor: "var(--border-default)",
                      background: "var(--bg-tertiary)",
                      color: "var(--text-secondary)",
                    }}
                    onClick={() => {
                      void navigator.clipboard.writeText(line);
                    }}
                  >
                    Copy
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}
